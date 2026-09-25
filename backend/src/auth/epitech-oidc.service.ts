import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../common/token-encryption.util';
import { SESSION_TTL_MS } from './auth.service';

const DEFAULT_DISCOVERY = 'https://my.epitech.eu/api/oidc/.well-known/openid-configuration';
const META_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_S = 120;

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export interface EpitechClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  campus?: string;
  promotion?: string | number;
  cursus?: string;
  group_label?: string | string[];
}

// Non-secret facts kept with the linked account and shown to the user.
export interface EpitechProfile {
  login: string | null;
  name: string | null;
  email: string | null;
  campus: string | null;
  promotion: string | null;
  cursus: string | null;
  groups: string[];
}

const b64url = (buf: Buffer) => buf.toString('base64url');
const str = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v));

export function toEpitechProfile(c: EpitechClaims): EpitechProfile {
  const groups = Array.isArray(c.group_label) ? c.group_label : c.group_label ? [c.group_label] : [];
  return {
    login: str(c.preferred_username) ?? str(c.email),
    name: str(c.name) ?? ([c.given_name, c.family_name].filter(Boolean).join(' ') || null),
    email: str(c.email),
    campus: str(c.campus),
    promotion: str(c.promotion),
    cursus: str(c.cursus),
    groups: groups.map(String),
  };
}

// "Connect with My Epitech" (OpenID Connect, code flow + PKCE). The provider
// only releases identity claims — see API.md for what that does and does not allow.
// Discovery/JWKS are fetched from the fixed, configured issuer — never from user input.
@Injectable()
export class EpitechOidcService {
  private meta: { at: number; discovery: Discovery; keys: any[] } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get clientId() {
    return this.config.get<string>('EPITECH_OIDC_CLIENT_ID');
  }
  private get clientSecret() {
    return this.config.get<string>('EPITECH_OIDC_CLIENT_SECRET');
  }
  private get callbackUrl() {
    return this.config.get<string>('EPITECH_OIDC_CALLBACK_URL');
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl && this.config.get<string>('TOKEN_ENCRYPTION_KEY'));
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new BadRequestException('My Epitech sign-in is not configured on the server');
  }

  private async loadMeta() {
    if (this.meta && Date.now() - this.meta.at < META_TTL_MS) return this.meta;
    const url = this.config.get<string>('EPITECH_OIDC_DISCOVERY_URL') || DEFAULT_DISCOVERY;
    const dRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!dRes.ok) throw new ServiceUnavailableException('My Epitech is unreachable');
    const discovery = (await dRes.json()) as Discovery;
    const kRes = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(10_000) });
    if (!kRes.ok) throw new ServiceUnavailableException('My Epitech is unreachable');
    this.meta = { at: Date.now(), discovery, keys: ((await kRes.json()) as { keys: any[] }).keys ?? [] };
    return this.meta;
  }

  // The values the callback must present again: state (CSRF), nonce (token replay), PKCE verifier.
  async start(): Promise<{ url: string; state: string; nonce: string; verifier: string }> {
    this.assertConfigured();
    const { discovery } = await this.loadMeta();
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    const verifier = b64url(randomBytes(32));
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId as string,
      redirect_uri: this.callbackUrl as string,
      scope: 'openid profile email groups',
      state,
      nonce,
      code_challenge: b64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    });
    return { url: `${discovery.authorization_endpoint}?${params}`, state, nonce, verifier };
  }

  async redeem(code: string, verifier: string, nonce: string): Promise<{ claims: EpitechClaims; accessToken: string; refreshToken: string | null }> {
    this.assertConfigured();
    const { discovery } = await this.loadMeta();
    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.callbackUrl as string,
        client_id: this.clientId as string,
        client_secret: this.clientSecret as string,
        code_verifier: verifier,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id_token?: string; access_token?: string; refresh_token?: string; error?: string };
    if (!res.ok || !data.id_token || !data.access_token) {
      throw new BadRequestException(`My Epitech did not accept the sign-in (${data.error ?? res.status})`);
    }
    const claims = await this.verifyIdToken(data.id_token, nonce);
    return { claims, accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
  }

  // RS256 signature against the provider's published keys, then iss/aud/exp/nonce.
  async verifyIdToken(idToken: string, nonce: string): Promise<EpitechClaims> {
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new BadRequestException('Invalid My Epitech identity token');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (header.alg !== 'RS256') throw new BadRequestException('Unsupported identity token algorithm');

    const { discovery, keys } = await this.loadMeta();
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) {
      this.meta = null; // keys may have rotated: refetch next time
      throw new BadRequestException('Unknown identity token signing key');
    }
    const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!ok) throw new BadRequestException('Invalid identity token signature');

    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== discovery.issuer) throw new BadRequestException('Identity token issuer mismatch');
    if (!aud.includes(this.clientId)) throw new BadRequestException('Identity token audience mismatch');
    if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < now) throw new BadRequestException('Identity token expired');
    if (payload.nonce !== nonce) throw new BadRequestException('Identity token nonce mismatch');
    if (typeof payload.sub !== 'string' || !payload.sub) throw new BadRequestException('Identity token has no subject');
    return payload as EpitechClaims;
  }

  // ---- account operations (userId for `link` always comes from the session) ----

  async link(userId: string, code: string, verifier: string, nonce: string): Promise<void> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY') as string;
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'epitech', providerAccountId: claims.sub } },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException('This My Epitech account is already linked to another user');
    }
    const data = {
      accessTokenEncrypted: encryptToken(accessToken, key),
      refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken, key) : null,
      profile: toEpitechProfile(claims) as object,
    };
    if (existing) {
      await this.prisma.oAuthAccount.update({ where: { id: existing.id }, data });
      return;
    }
    // One My Epitech account per platform user: replace a previous link.
    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider: 'epitech' } });
    await this.prisma.oAuthAccount.create({ data: { provider: 'epitech', providerAccountId: claims.sub, userId, ...data } });
  }

  // Same three cases as "Sign in with GitHub": known account → log in; same verified
  // email as a local account → link it; otherwise create the account.
  async login(code: string, verifier: string, nonce: string): Promise<{ id: string; expiresAt: Date }> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY') as string;
    const tokens = {
      accessTokenEncrypted: encryptToken(accessToken, key),
      refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken, key) : null,
      profile: toEpitechProfile(claims) as object,
    };

    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'epitech', providerAccountId: claims.sub } },
      include: { user: true },
    });
    let user;
    if (account) {
      user = account.user;
      await this.prisma.oAuthAccount.update({ where: { id: account.id }, data: tokens });
    } else {
      const email = claims.email?.toLowerCase();
      if (!email || claims.email_verified !== true) {
        throw new BadRequestException('Your My Epitech account has no verified email address to sign in with');
      }
      user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: claims.given_name ?? email.split('@')[0],
            lastName: claims.family_name ?? email.split('@')[0],
            emailVerified: true,
            isAdmin: adminEmails.includes(email),
          },
        });
      }
      await this.prisma.oAuthAccount.create({ data: { provider: 'epitech', providerAccountId: claims.sub, userId: user.id, ...tokens } });
    }
    if (user.isBanned) throw new ForbiddenException('This account has been suspended');
    return this.prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  }

  async unlink(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const account = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider: 'epitech' } });
    if (!user || !account) throw new NotFoundException('No linked My Epitech account for this user');
    const otherLogin = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider: 'github' } });
    if (!user.passwordHash && !otherLogin) {
      throw new ConflictException('This account has no password — unlinking My Epitech would lock you out. Set a password first.');
    }
    await this.prisma.oAuthAccount.delete({ where: { id: account.id } });
  }

  async profileOf(userId: string): Promise<EpitechProfile | null> {
    const account = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider: 'epitech' } });
    return account ? ((account.profile as unknown as EpitechProfile | null) ?? null) : null;
  }
}
