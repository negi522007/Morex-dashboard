import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newPkce, verifyIdToken } from '../common/oidc.util';
import { OidcAccountsService } from './oidc-accounts.service';
import type { OidcFlow } from './oidc-controller.factory';

const DEFAULT_DISCOVERY = 'https://my.epitech.eu/api/oidc/.well-known/openid-configuration';
const META_TTL_MS = 60 * 60 * 1000;
const PROVIDER = 'epitech';
const LABEL = 'My Epitech';

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

// "Connect / Sign in with My Epitech" (OpenID Connect, code flow + PKCE). The provider only releases
// identity claims — see API.md for what that does and does not allow. Discovery and keys come from the
// fixed, configured issuer — never from user input.
@Injectable()
export class EpitechOidcService implements OidcFlow {
  private meta: { at: number; discovery: Discovery; keys: any[] } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly accounts: OidcAccountsService,
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

  async start(): Promise<{ url: string; state: string; nonce: string; verifier: string }> {
    this.assertConfigured();
    const { discovery } = await this.loadMeta();
    const { state, nonce, verifier, challenge } = newPkce();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId as string,
      redirect_uri: this.callbackUrl as string,
      scope: 'openid profile email groups',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `${discovery.authorization_endpoint}?${params}`, state, nonce, verifier };
  }

  async redeem(code: string, verifier: string, nonce: string) {
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

  async verifyIdToken(idToken: string, nonce: string): Promise<EpitechClaims> {
    const { discovery, keys } = await this.loadMeta();
    return verifyIdToken(idToken, keys, { issuer: discovery.issuer, audience: this.clientId as string, nonce }, () => (this.meta = null)) as EpitechClaims;
  }

  async link(userId: string, code: string, verifier: string, nonce: string): Promise<void> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    await this.accounts.link(PROVIDER, LABEL, userId, { subject: claims.sub, accessToken, refreshToken, profile: toEpitechProfile(claims) });
  }

  async login(code: string, verifier: string, nonce: string): Promise<{ id: string; expiresAt: Date }> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    return this.accounts.login(
      PROVIDER,
      LABEL,
      { subject: claims.sub, accessToken, refreshToken, profile: toEpitechProfile(claims) },
      { email: claims.email ?? null, emailVerified: claims.email_verified === true, firstName: claims.given_name ?? null, lastName: claims.family_name ?? null },
    );
  }

  unlink(userId: string): Promise<void> {
    return this.accounts.unlink(PROVIDER, LABEL, userId);
  }

  profileOf(userId: string): Promise<EpitechProfile | null> {
    return this.accounts.profileOf<EpitechProfile>(PROVIDER, userId);
  }
}
