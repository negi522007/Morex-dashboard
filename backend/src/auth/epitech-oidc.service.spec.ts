import { generateKeyPairSync, createSign } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EpitechOidcService, toEpitechProfile } from './epitech-oidc.service';
import { OidcAccountsService } from './oidc-accounts.service';

const KEY = 'a'.repeat(64);
const ISS = 'https://my.epitech.eu/oidc';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

function sign(payload: object, header: object = { alg: 'RS256', kid: 'k1' }, key = privateKey) {
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createSign('RSA-SHA256').update(`${h}.${p}`).sign(key).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const claims = (over: object = {}) => ({
  iss: ISS, aud: 'cid', sub: 's1', nonce: 'n1', exp: Math.floor(Date.now() / 1000) + 300,
  email: 'ada.lovelace@epitech.eu', email_verified: true, given_name: 'Ada', family_name: 'Lovelace',
  preferred_username: 'ada.lovelace@epitech.eu', campus: 'Cotonou', promotion: 2028, cursus: 'pge', group_label: ['G1'], ...over,
});

function make(idToken: string) {
  const prisma: any = {
    oAuthAccount: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn(async (a: any) => ({ id: 'u1', isBanned: false, ...a.data })) },
    session: { create: jest.fn(async (a: any) => ({ id: 'sess', ...a.data })) },
  };
  const env: Record<string, string> = {
    EPITECH_OIDC_CLIENT_ID: 'cid', EPITECH_OIDC_CLIENT_SECRET: 'sec', EPITECH_OIDC_CALLBACK_URL: 'http://localhost:8080/auth/epitech/callback', TOKEN_ENCRYPTION_KEY: KEY,
  };
  global.fetch = jest.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('openid-configuration')) return new Response(JSON.stringify({ issuer: ISS, authorization_endpoint: `${ISS}/authorize`, token_endpoint: `${ISS}/token`, jwks_uri: `${ISS}/jwks` }));
    if (u.endsWith('/jwks')) return new Response(JSON.stringify({ keys: [jwk] }));
    if (u.endsWith('/token')) return new Response(JSON.stringify({ id_token: idToken, access_token: 'at', refresh_token: 'rt' }));
    throw new Error('unexpected ' + u);
  }) as any;
  const config: any = { get: (k: string) => env[k] };
  return { prisma, svc: new EpitechOidcService(config, new OidcAccountsService(prisma, config)) };
}

describe('EpitechOidcService', () => {
  it('builds an authorize URL with PKCE S256, state and nonce', async () => {
    const { svc } = make('x');
    const s = await svc.start();
    const u = new URL(s.url);
    expect(u.origin + u.pathname).toBe(`${ISS}/authorize`);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe(s.state);
    expect(u.searchParams.get('nonce')).toBe(s.nonce);
    expect(u.searchParams.get('scope')).toBe('openid profile email groups');
    expect(u.searchParams.get('client_secret')).toBeNull();
  });

  it('refuses to start when not configured', async () => {
    const svc = new EpitechOidcService({ get: () => undefined } as any, {} as any);
    expect(svc.isConfigured()).toBe(false);
    await expect(svc.start()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a correctly signed token', async () => {
    const { svc } = make('x');
    expect(await svc.verifyIdToken(sign(claims()), 'n1')).toMatchObject({ sub: 's1' });
  });

  it.each([
    ['a forged signature', () => sign(claims(), { alg: 'RS256', kid: 'k1' }, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)],
    ['the wrong issuer', () => sign(claims({ iss: 'https://evil.test' }))],
    ['the wrong audience', () => sign(claims({ aud: 'other' }))],
    ['an expired token', () => sign(claims({ exp: 1 }))],
    ['a replayed nonce', () => sign(claims({ nonce: 'other' }))],
    ['alg none', () => sign(claims(), { alg: 'none', kid: 'k1' })],
    ['an unknown key id', () => sign(claims(), { alg: 'RS256', kid: 'zzz' })],
  ])('rejects %s', async (_n, mk) => {
    const { svc } = make('x');
    await expect(svc.verifyIdToken(mk(), 'n1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login creates a verified account with the Epitech profile stored (tokens encrypted)', async () => {
    const { svc, prisma } = make(sign(claims()));
    const session = await svc.login('code', 'ver', 'n1');
    expect(session.id).toBe('sess');
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ email: 'ada.lovelace@epitech.eu', emailVerified: true, firstName: 'Ada' });
    const acct = prisma.oAuthAccount.create.mock.calls[0][0].data;
    expect(acct).toMatchObject({ provider: 'epitech', providerAccountId: 's1' });
    expect(acct.accessTokenEncrypted).not.toContain('at');
    expect(acct.profile).toMatchObject({ campus: 'Cotonou', promotion: '2028', groups: ['G1'] });
  });

  it('login refuses an unverified email and never matches an account by it', async () => {
    const { svc, prisma } = make(sign(claims({ email_verified: false })));
    await expect(svc.login('c', 'v', 'n1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('login attaches to an existing account with the same verified email', async () => {
    const { svc, prisma } = make(sign(claims()));
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', isBanned: false });
    await svc.login('c', 'v', 'n1');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.oAuthAccount.create.mock.calls[0][0].data.userId).toBe('existing');
  });

  it('link refuses an Epitech account already owned by someone else', async () => {
    const { svc, prisma } = make(sign(claims()));
    prisma.oAuthAccount.findUnique.mockResolvedValue({ id: 'x', userId: 'other' });
    await expect(svc.link('me', 'c', 'v', 'n1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('unlink is blocked when it is the only way to log in', async () => {
    const { svc, prisma } = make('x');
    prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: null });
    prisma.oAuthAccount.findFirst.mockImplementation(async (a: any) => (a.where.provider === 'epitech' ? { id: 'a' } : null));
    await expect(svc.unlink('u')).rejects.toBeInstanceOf(ConflictException);
    prisma.user.findUnique.mockResolvedValue({ id: 'u', passwordHash: 'h' });
    await svc.unlink('u');
    expect(prisma.oAuthAccount.delete).toHaveBeenCalled();
  });

  it('toEpitechProfile tolerates missing claims', () => {
    expect(toEpitechProfile({ sub: 's', email: 'a@b.c' })).toEqual({ login: 'a@b.c', name: null, email: 'a@b.c', campus: null, promotion: null, cursus: null, groups: [] });
  });
});
