import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { newPkce, verifyIdToken } from '../common/oidc.util';
import { OidcAccountsService } from './oidc-accounts.service';
import type { OidcFlow } from './oidc-controller.factory';

const META_TTL_MS = 60 * 60 * 1000;
const PROVIDER = 'microsoft';
const LABEL = 'Microsoft';
// Any real Microsoft Entra ID tenant's v2.0 issuer looks like this, with a genuine tenant GUID in the
// middle (the fixed GUID 9188040d-6c67-4c5b-b112-36a304b66dad is Microsoft's own well-known tenant for
// personal Microsoft accounts, and also matches here) — checked instead of one fixed string precisely
// because this integration no longer pins to a single organisation. See loadMeta()'s comment for why the
// "common" discovery document's own `issuer` field can't be compared directly.
const ISSUER_PATTERN = /^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/i;

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

// "Sign in with Microsoft" — any real Microsoft Entra ID or personal Microsoft account, not restricted
// to one organisation. Previously pinned to epitech.eu only; broadened at the user's request.
//
// What changed, and the one thing that couldn't just go away: with a single fixed organisation, the
// signed `tid` claim provably belonged to the one tenant that owns the allowed domain, so its `email`
// claim could be trusted outright. Opened up to ANY tenant, that trust is gone — any Entra ID tenant
// admin can set an arbitrary user's email/UPN attribute to someone else's real address (the "nOAuth"
// class of vulnerability), so the email claim alone is no longer proof of who's signing in. The mitigation
// lives in OidcAccountsService.login's `allowLinkByEmail: false` passed from login() below: a brand-new
// Microsoft sign-in can still create a fresh account from whatever email it reports, but it will never be
// silently attached to an already-existing one just because the email happens to match — that would be
// exactly how someone else's account gets taken over. Linking Microsoft to an existing account still
// works fine from the profile page, while already logged in as that account for real.
@Injectable()
export class MicrosoftOidcService implements OidcFlow {
  private meta: { at: number; discovery: Discovery; keys: any[] } | null = null;

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

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.callbackUrl && this.config.get<string>('TOKEN_ENCRYPTION_KEY'));
  }

  private assertConfigured() {
    if (!this.isConfigured()) throw new BadRequestException('Microsoft sign-in is not configured on the server');
  }

  private async loadMeta() {
    if (this.meta && Date.now() - this.meta.at < META_TTL_MS) return this.meta;
    // "common" accepts any organisation AND personal Microsoft accounts (whichever the app registration's
    // own "supported account types" allows — this endpoint doesn't restrict it further). Its own `issuer`
    // field is a literal, unresolved "{tenantid}" placeholder, not a real value — comparing a real token's
    // issuer against it would always fail, which is exactly why verifyIdToken() below uses ISSUER_PATTERN
    // instead of discovery.issuer.
    const url = this.config.get<string>('MICROSOFT_DISCOVERY_URL') || 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration';
    const dRes = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!dRes.ok) throw new ServiceUnavailableException('Microsoft is unreachable');
    const discovery = (await dRes.json()) as Discovery;
    const kRes = await fetch(discovery.jwks_uri, { signal: AbortSignal.timeout(10_000) });
    if (!kRes.ok) throw new ServiceUnavailableException('Microsoft is unreachable');
    this.meta = { at: Date.now(), discovery, keys: ((await kRes.json()) as { keys: any[] }).keys ?? [] };
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

  // Signature + issuer (any real Microsoft tenant, see ISSUER_PATTERN) + audience + nonce, then the address.
  async verifyIdToken(idToken: string, nonce: string): Promise<MicrosoftClaims & { address: string }> {
    const { keys } = await this.loadMeta();
    const claims = verifyIdToken(idToken, keys, { issuer: ISSUER_PATTERN, audience: this.clientId as string, nonce }, () => (this.meta = null)) as MicrosoftClaims;
    const address = String(claims.email ?? claims.preferred_username ?? '').toLowerCase();
    if (!address) throw new BadRequestException('This Microsoft account has no usable email address');
    return { ...claims, address };
  }

  private grant(claims: MicrosoftClaims & { address: string }, accessToken: string, refreshToken: string | null) {
    // Purely informational (shown back to the user as "connected as X @ Y") — never used for any trust
    // decision, unlike when this was pinned to one organisation.
    const profile: MicrosoftProfile = { name: claims.name ?? null, email: claims.address, tenant: claims.address.split('@')[1] ?? 'microsoft' };
    // `oid` is the person's stable id inside their tenant; `tid` makes it globally unique across tenants.
    return { subject: `${claims.tid}.${claims.oid ?? claims.sub}`, accessToken, refreshToken, profile };
  }

  async link(userId: string, code: string, verifier: string, nonce: string): Promise<void> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    await this.accounts.link(PROVIDER, LABEL, userId, this.grant(claims, accessToken, refreshToken));
  }

  async login(code: string, verifier: string, nonce: string): Promise<{ id: string; expiresAt: Date }> {
    const { claims, accessToken, refreshToken } = await this.redeem(code, verifier, nonce);
    const [first, ...rest] = (claims.name ?? '').trim().split(/\s+/).filter(Boolean);
    return this.accounts.login(
      PROVIDER,
      LABEL,
      this.grant(claims, accessToken, refreshToken),
      {
        email: claims.address,
        emailVerified: true, // Microsoft vouches for the address itself; just not for who else might share it (see the class comment)
        firstName: first ?? null,
        lastName: rest.join(' ') || null,
      },
      { allowLinkByEmail: false },
    );
  }

  unlink(userId: string): Promise<void> {
    return this.accounts.unlink(PROVIDER, LABEL, userId);
  }

  profileOf(userId: string): Promise<MicrosoftProfile | null> {
    return this.accounts.profileOf<MicrosoftProfile>(PROVIDER, userId);
  }
}
