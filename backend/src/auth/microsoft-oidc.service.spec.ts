import { createSign, generateKeyPairSync } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { MicrosoftOidcService } from './microsoft-oidc.service';
import { OidcAccountsService } from './oidc-accounts.service';

const TID = '901cb4ca-b862-4029-9306-e5cd0f6d9f86';
const OTHER_TID = '11111111-2222-3333-4444-555555555555';
const ISS = `https://login.microsoftonline.com/${TID}/v2.0`;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };

function sign(payload: object, key = privateKey) {
  const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${h}.${p}.${createSign('RSA-SHA256').update(`${h}.${p}`).sign(key).toString('base64url')}`;
}
const claims = (over: object = {}) => ({
  iss: ISS, aud: 'cid', sub: 'pairwise', oid: 'oid-1', tid: TID, nonce: 'n1', exp: Math.floor(Date.now() / 1000) + 300,
  name: 'Ada Lovelace', preferred_username: 'ada.lovelace@epitech.eu', ...over,
});

function make(idToken = 'x', env: Record<string, string> = {}) {
  const prisma: any = {
    oAuthAccount: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async (a: any) => ({ id: 'u1', isBanned: false, ...a.data })) },
    session: { create: jest.fn(async (a: any) => ({ id: 'sess', ...a.data })) },
  };
  const cfg: Record<string, string> = { MICROSOFT_CLIENT_ID: 'cid', MICROSOFT_CLIENT_SECRET: 'sec', MICROSOFT_CALLBACK_URL: 'http://localhost:8080/auth/microsoft/callback', TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), ...env };
  const config: any = { get: (k: string) => cfg[k] };
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('.well-known')) return new Response(JSON.stringify({ issuer: ISS, authorization_endpoint: `https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize`, token_endpoint: `https://login.microsoftonline.com/${TID}/oauth2/v2.0/token`, jwks_uri: 'https://login.microsoftonline.com/keys' }));
    if (u.endsWith('/keys')) return new Response(JSON.stringify({ keys: [jwk] }));
    if (u.endsWith('/token')) return new Response(JSON.stringify({ id_token: idToken, access_token: 'at', refresh_token: 'rt' }));
    throw new Error('unexpected ' + u);
  }) as any;
  return { prisma, svc: new MicrosoftOidcService(config, new OidcAccountsService(prisma, config)) };
}

describe('MicrosoftOidcService', () => {
  it('sends the user to the Epitech organisation with PKCE, state, nonce and a domain hint', async () => {
    const { svc } = make();
    const s = await svc.start();
    const u = new URL(s.url);
    expect(u.pathname).toBe(`/${TID}/oauth2/v2.0/authorize`);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toBe('openid profile email');
    expect(u.searchParams.get('domain_hint')).toBe('epitech.eu');
    expect(u.searchParams.get('client_secret')).toBeNull();
  });

  it('is not configured without client id/secret', () => {
    const svc = new MicrosoftOidcService({ get: () => undefined } as any, {} as any);
    expect(svc.isConfigured()).toBe(false);
  });

  it('accepts a correctly signed token from the Epitech organisation', async () => {
    const { svc } = make();
    expect(await svc.verifyIdToken(sign(claims()), 'n1')).toMatchObject({ address: 'ada.lovelace@epitech.eu', oid: 'oid-1' });
  });

  it('refuses an account from ANOTHER organisation even if it claims an @epitech.eu address (the nOAuth attack)', async () => {
    const { svc } = make();
    // Same signing keys and audience, but the account lives in a different tenant.
    const forged = sign(claims({ tid: OTHER_TID, email: 'ada.lovelace@epitech.eu' }));
    await expect(svc.verifyIdToken(forged, 'n1')).rejects.toThrow(/Only epitech\.eu accounts/);
  });

  it('refuses an Epitech-tenant account whose address is outside the allowed domain', async () => {
    const { svc } = make();
    await expect(svc.verifyIdToken(sign(claims({ preferred_username: 'x@evil.test' })), 'n1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['a forged signature', () => sign(claims(), generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)],
    ['the wrong audience', () => sign(claims({ aud: 'other' }))],
    ['the wrong issuer', () => sign(claims({ iss: 'https://evil.test/v2.0' }))],
    ['an expired token', () => sign(claims({ exp: 1 }))],
    ['a replayed nonce', () => sign(claims({ nonce: 'other' }))],
  ])('rejects %s', async (_n, mk) => {
    const { svc } = make();
    await expect(svc.verifyIdToken(mk(), 'n1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login creates a verified account from the organisation identity, keyed by tenant + oid, tokens encrypted', async () => {
    const { svc, prisma } = make(sign(claims()));
    const session = await svc.login('code', 'ver', 'n1');
    expect(session.id).toBe('sess');
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ email: 'ada.lovelace@epitech.eu', emailVerified: true, firstName: 'Ada', lastName: 'Lovelace' });
    const acct = prisma.oAuthAccount.create.mock.calls[0][0].data;
    expect(acct).toMatchObject({ provider: 'microsoft', providerAccountId: `${TID}.oid-1` });
    expect(acct.accessTokenEncrypted).not.toContain('at');
    expect(acct.profile).toEqual({ name: 'Ada Lovelace', email: 'ada.lovelace@epitech.eu', tenant: 'epitech.eu' });
  });

  it('login attaches to the existing local account with the same address instead of duplicating it', async () => {
    const { svc, prisma } = make(sign(claims()));
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', isBanned: false });
    await svc.login('c', 'v', 'n1');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.oAuthAccount.create.mock.calls[0][0].data.userId).toBe('existing');
  });

  it('can be pointed at another organisation with MICROSOFT_ALLOWED_DOMAIN', async () => {
    const { svc } = make(sign(claims({ preferred_username: 'bob@school.example' })), { MICROSOFT_ALLOWED_DOMAIN: 'school.example' });
    expect(await svc.verifyIdToken(sign(claims({ preferred_username: 'bob@school.example' })), 'n1')).toMatchObject({ address: 'bob@school.example' });
  });
});
