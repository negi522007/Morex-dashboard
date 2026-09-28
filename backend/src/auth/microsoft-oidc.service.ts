import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newPkce, verifyIdToken } from '../common/oidc.util';
import { OidcAccountsService } from './oidc-accounts.service';
import type { OidcFlow } from './oidc-controller.factory';

const META_TTL_MS = 60 * 60 * 1000;
const PROVIDER = 'microsoft';
const LABEL = 'Microsoft';
const DEFAULT_DOMAIN = 'epitech.eu';

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export interface MicrosoftClaims {
  sub: string;
  oid?: string;
  tid?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
}

export interface MicrosoftProfile {
  name: string | null;
  email: string;
  tenant: string;
}

// "Sign in with your school Microsoft account", restricted to ONE organisation (default epitech.eu).
//
// Why the restriction is not optional: in a multi-tenant Microsoft app the `email` claim of an account
// from ANY organisation is whatever that organisation's admin set — it proves nothing. So the account
// must belong to the tenant that owns the allowed domain (the signed `tid` claim), and only then is the
// address trusted. The tenant is looked up from Microsoft's public metadata for that domain, so there
// is no tenant id to configure.
@Injectable()
export class MicrosoftOidcService implements OidcFlow {
  private meta: { at: number; discovery: Discovery; tenantId: string; keys: any[] } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly accounts: OidcAccountsService,
  ) {}

  private get clientId() {
    return this.config.get<string>('MICROSOFT_CLIENT_ID');
  }
  private get clientSecret() {
    return this.config.get<string>('MICROSOFT_CLIENT_SECRET');
  }
  private get callbackUrl() {
    return this.config.get<string>('MICROSOFT_CALLBACK_URL');
  }
  private get domain() {
    return (this.config.get<string>('MICROSOFT_ALLOWED_DOMAIN') || DEFAULT_DOMAIN).toLowerCase();
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl && this.config.get<string>('TOKEN_ENCRYPTION_KEY'));
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new BadRequestException('Microsoft sign-in is not configured on the server');
  }

  private async loadMeta() {
    if (this.meta && Date.now() - this.meta.at < META_TTL_MS) return this.meta;
    const url =
      this.config.get<string>('MICROSOFT_DISCOVERY_URL') || `https://login.microsoftonline.com/${encodeURIComponent(this.domain)}/v2.0/.well-known/openid-configuration`;
    const dRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!dRes.ok) throw new ServiceUnavailableException('Microsoft is unreachable');
    const discovery = (await dRes.json()) as Discovery;
    const tenantId = /\/([0-9a-f-]{36})\/v2\.0\/?$/i.exec(discovery.issuer)?.[1];
    if (!tenantId) throw new ServiceUnavailableException(`Could not find the Microsoft organisation for ${this.domain}`);
    const kRes = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(10_000) });
    if (!kRes.ok) throw new ServiceUnavailableException('Microsoft is unreachable');
    this.meta = { at: Date.now(), discovery, tenantId, keys: ((await kRes.json()) as { keys: any[] }).keys ?? [] };
    return this.meta;
  }

  async start(): Promise<{ url: string; state: string; nonce: string; verifier: string }> {
    this.assertConfigured();
    const { discovery } = await this.loadMeta();
    const { state, nonce, verifier, challenge } = newPkce();
    const params = new URLSearchParams({
      response_type: 'code',
      response_mode: 'query',
      client_id: this.clientId as string,
      redirect_uri: this.callbackUrl as string,
      scope: 'openid profile email',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      domain_hint: this.domain,
      prompt: 'select_account',
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
        scope: 'openid profile email',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id_token?: string; access_token?: string; refresh_token?: string; error?: string };
    if (!res.ok || !data.id_token || !data.access_token) {
      throw new BadRequestException(`Microsoft did not accept the sign-in (${data.error ?? res.status})`);
    }
    const claims = await this.verifyIdToken(data.id_token, nonce);
    return { claims, accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
  }

  // Signature + issuer + audience + nonce, then the organisation and the address.
  async verifyIdToken(idToken: string, nonce: string): Promise<MicrosoftClaims & { address: string }> {
    const { discovery, keys, tenantId } = await this.loadMeta();
    const claims = verifyIdToken(idToken, keys, { issuer: discovery.issuer, audience: this.clientId as string, nonce }, () => (this.meta = null)) as MicrosoftClaims;
    if (claims.tid !== tenantId) throw new BadRequestException(`Only ${this.domain} accounts can sign in with Microsoft here`);
    const address = String(claims.email ?? claims.preferred_username ?? '').toLowerCase();
    if (!address.endsWith(`@${this.domain}`)) throw new BadRequestException(`Only ${this.domain} accounts can sign in with Microsoft here`);
    return { ...claims, address };
  }

  private grant(claims: MicrosoftClaims & { address: string }, accessToken: string, refreshToken: string | null) {
    const profile: MicrosoftProfile = { name: claims.name ?? null, email: claims.address, tenant: this.domain };
    // `oid` is the person's stable id inside the organisation.
    return { subject: `${claims.tid}.${claims.oid ?? claims.sub}`, accessToken, refreshToken, profile };
  }

  async link(userId: string, code: string, verifier: string, nonce: string): Promise<void> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    await this.accounts.link(PROVIDER, LABEL, userId, this.grant(claims, accessToken, refreshToken));
  }

  async login(code: string, verifier: string, nonce: string): Promise<{ id: string; expiresAt: Date }> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    const [first, ...rest] = (claims.name ?? '').trim().split(/\s+/).filter(Boolean);
    return this.accounts.login(PROVIDER, LABEL, this.grant(claims, accessToken, refreshToken), {
      email: claims.address,
      emailVerified: true, // the organisation vouches for it (checked in verifyIdToken)
      firstName: first ?? null,
      lastName: rest.join(' ') || null,
    });
  }

  unlink(userId: string): Promise<void> {
    return this.accounts.unlink(PROVIDER, LABEL, userId);
  }

  profileOf(userId: string): Promise<MicrosoftProfile | null> {
    return this.accounts.profileOf<MicrosoftProfile>(PROVIDER, userId);
  }
}
