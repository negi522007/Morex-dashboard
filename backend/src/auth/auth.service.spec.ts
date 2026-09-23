import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword } from './password.util';

function makePrismaMock() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    session: { create: jest.fn(), deleteMany: jest.fn(), findUnique: jest.fn() },
    oAuthAccount: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function makeConfigMock(values: Record<string, string> = {}) {
  return { get: jest.fn((key: string): string | undefined => values[key]) };
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let mail: { sendConfirmationEmail: jest.Mock };
  let config: ReturnType<typeof makeConfigMock>;
  let service: AuthService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    prisma = makePrismaMock();
    mail = { sendConfirmationEmail: jest.fn().mockResolvedValue(undefined) };
    config = makeConfigMock({
      APP_URL: 'http://localhost:8080',
      GITHUB_CLIENT_ID: 'client-id',
      GITHUB_CLIENT_SECRET: 'client-secret',
      GITHUB_OAUTH_CALLBACK_URL: 'http://localhost:8080/auth/github/callback',
      TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    });
    service = new AuthService(prisma as any, mail as any, config as any);
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  describe('register', () => {
    it('rejects an email that already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register('taken@example.com', 'password123', 'Test', 'User'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates the user, issues a token, and sends the confirmation email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });

      const result = await service.register('new@example.com', 'password123', 'Ada', 'Lovelace');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: 'Ada', lastName: 'Lovelace' }),
        }),
      );
      expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(mail.sendConfirmationEmail).toHaveBeenCalledWith(
        'new@example.com',
        expect.stringContaining('http://localhost:8080/auth/confirm?token='),
      );
      expect(result).toEqual({ id: 'user-1', email: 'new@example.com', firstName: 'Ada', lastName: 'Lovelace' });
    });

    it('auto-promotes to admin when the email is in ADMIN_EMAILS, case-insensitively', async () => {
      config.get.mockImplementation((key: string): string | undefined =>
        key === 'ADMIN_EMAILS' ? 'boss@example.com, ADMIN@EXAMPLE.COM' : 'set',
      );
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'admin@example.com' });

      await service.register('admin@example.com', 'password123', 'Test', 'User');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isAdmin: true }) }),
      );
    });

    it('does not promote an email that is not in ADMIN_EMAILS', async () => {
      config.get.mockImplementation((key: string): string | undefined =>
        key === 'ADMIN_EMAILS' ? 'boss@example.com' : 'set',
      );
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'nobody@example.com' });

      await service.register('nobody@example.com', 'password123', 'Test', 'User');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isAdmin: false }) }),
      );
    });

    it('deletes the user and surfaces a 503 if the confirmation email fails to send', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1', email: 'new@example.com' });
      mail.sendConfirmationEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        service.register('new@example.com', 'password123', 'Test', 'User'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });

  describe('confirmEmail', () => {
    it('rejects a token that does not exist', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
      await expect(service.confirmEmail('nope')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.confirmEmail('expired')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('marks the user verified and deletes the token on success', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000),
      });
      await service.confirmEmail('good-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerified: true },
      });
      expect(prisma.emailVerificationToken.delete).toHaveBeenCalledWith({ where: { token: 'good-token' } });
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'password123')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash, emailVerified: true });
      await expect(service.login('user@example.com', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a correct password on a banned account, even before checking email confirmation', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash,
        emailVerified: true,
        isBanned: true,
      });
      await expect(service.login('user@example.com', 'the-real-password')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('rejects a correct password on an unconfirmed account', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash, emailVerified: false });
      await expect(service.login('user@example.com', 'the-real-password')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('creates a session for a verified user with the right password', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
        emailVerified: true,
      });
      prisma.session.create.mockResolvedValue({ id: 'session-1', expiresAt: new Date() });

      const result = await service.login('user@example.com', 'the-real-password');

      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(result.user).toEqual({ id: 'user-1', email: 'user@example.com' });
      expect(result.session.id).toBe('session-1');
    });
  });

  describe('logout', () => {
    it('deletes the session row', async () => {
      await service.logout('session-1');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });
  });

  describe('getUserBySession', () => {
    it('returns null when the session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      await expect(service.getUserBySession('nope')).resolves.toBeNull();
    });

    it('returns null when the session has expired', async () => {
      prisma.session.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-1', email: 'a@example.com' },
      });
      await expect(service.getUserBySession('expired')).resolves.toBeNull();
    });

    it('returns the user for a valid session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        expiresAt: new Date(Date.now() + 1000),
        user: { id: 'user-1', email: 'a@example.com' },
      });
      await expect(service.getUserBySession('valid')).resolves.toEqual({ id: 'user-1', email: 'a@example.com' });
    });
  });

  describe('linkGithubAccount', () => {
    function mockGithubExchange(profileId = 197103084) {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/login/oauth/access_token')) {
          return Promise.resolve({ json: () => Promise.resolve({ access_token: 'gho_token' }) });
        }
        if (url.includes('/api.github.com/user')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: profileId, login: 'octocat' }) });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      });
    }

    it('creates a new OAuthAccount when none exists for this GitHub id', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);

      await service.linkGithubAccount('user-1', 'auth-code');

      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ provider: 'github', providerAccountId: '197103084', userId: 'user-1' }),
        }),
      );
    });

    it('refreshes the token when the same user re-links the same GitHub account', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue({ id: 'oauth-1', userId: 'user-1' });

      await service.linkGithubAccount('user-1', 'auth-code');

      expect(prisma.oAuthAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'oauth-1' } }),
      );
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('refuses to relink a GitHub account already owned by a different user', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue({ id: 'oauth-1', userId: 'someone-else' });

      await expect(service.linkGithubAccount('user-1', 'auth-code')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.oAuthAccount.update).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    });

    it('rejects when GitHub does not return an access token', async () => {
      fetchMock.mockResolvedValue({ json: () => Promise.resolve({ error: 'bad_verification_code' }) });
      await expect(service.linkGithubAccount('user-1', 'bad-code')).rejects.toThrow(/did not return an access token/);
    });

    it('rejects when the server has no TOKEN_ENCRYPTION_KEY configured', async () => {
      config.get.mockImplementation((key: string) => (key === 'TOKEN_ENCRYPTION_KEY' ? undefined : 'set'));
      await expect(service.linkGithubAccount('user-1', 'auth-code')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('unlinkGithubAccount', () => {
    it('rejects if the user has no linked GitHub account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'salt:hash' });
      prisma.oAuthAccount.findFirst.mockResolvedValue(null);

      await expect(service.unlinkGithubAccount('user-1')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.oAuthAccount.delete).not.toHaveBeenCalled();
    });

    it('refuses to unlink when the account has no password (would lock the user out)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: null });
      prisma.oAuthAccount.findFirst.mockResolvedValue({ id: 'oauth-1' });

      await expect(service.unlinkGithubAccount('user-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.oAuthAccount.delete).not.toHaveBeenCalled();
    });

    it('deletes the OAuthAccount when the user has a password to fall back on', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'salt:hash' });
      prisma.oAuthAccount.findFirst.mockResolvedValue({ id: 'oauth-1' });

      await service.unlinkGithubAccount('user-1');

      expect(prisma.oAuthAccount.delete).toHaveBeenCalledWith({ where: { id: 'oauth-1' } });
    });
  });

  describe('loginWithGithub', () => {
    function mockGithubExchange(opts: {
      profileId?: number;
      name?: string | null;
      emails?: { email: string; primary: boolean; verified: boolean }[];
    } = {}) {
      const { profileId = 197103084, name = 'Ada Lovelace', emails = [{ email: 'ada@example.com', primary: true, verified: true }] } = opts;
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/login/oauth/access_token')) {
          return Promise.resolve({ json: () => Promise.resolve({ access_token: 'gho_token' }) });
        }
        if (url.includes('/user/emails')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(emails) });
        }
        if (url.includes('/api.github.com/user')) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: profileId, login: 'octocat', name }) });
        }
        throw new Error(`Unexpected fetch to ${url}`);
      });
    }

    it('logs in directly when the GitHub account is already linked', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        id: 'oauth-1',
        user: { id: 'user-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', isAdmin: false, isBanned: false },
      });
      prisma.session.create.mockResolvedValue({ id: 'session-1', expiresAt: new Date() });

      const result = await service.loginWithGithub('auth-code');

      expect(prisma.oAuthAccount.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'oauth-1' } }));
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-1');
    });

    it('links to an existing local account that matches the verified GitHub email, without creating a duplicate', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'L.',
        isAdmin: false,
        isBanned: false,
      });
      prisma.session.create.mockResolvedValue({ id: 'session-2', expiresAt: new Date() });

      const result = await service.loginWithGithub('auth-code');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-2', providerAccountId: '197103084' }) }),
      );
      expect(result.user.id).toBe('user-2');
    });

    it('registers a brand new, already-verified account when nothing matches', async () => {
      mockGithubExchange({ name: 'Grace Hopper', emails: [{ email: 'grace@example.com', primary: true, verified: true }] });
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-3',
        email: 'grace@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        isAdmin: false,
        isBanned: false,
      });
      prisma.session.create.mockResolvedValue({ id: 'session-3', expiresAt: new Date() });

      const result = await service.loginWithGithub('auth-code');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'grace@example.com',
            firstName: 'Grace',
            lastName: 'Hopper',
            emailVerified: true,
          }),
        }),
      );
      expect(result.user.id).toBe('user-3');
    });

    it('falls back to the GitHub login as both names when the profile has no display name', async () => {
      mockGithubExchange({ name: null, emails: [{ email: 'octo@example.com', primary: true, verified: true }] });
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-4',
        email: 'octo@example.com',
        firstName: 'octocat',
        lastName: 'octocat',
        isAdmin: false,
        isBanned: false,
      });
      prisma.session.create.mockResolvedValue({ id: 'session-4', expiresAt: new Date() });

      await service.loginWithGithub('auth-code');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ firstName: 'octocat', lastName: 'octocat' }) }),
      );
    });

    it('rejects when GitHub has no verified email at all', async () => {
      mockGithubExchange({ emails: [{ email: 'unverified@example.com', primary: true, verified: false }] });
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);

      await expect(service.loginWithGithub('auth-code')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a banned user even when their GitHub account is already linked', async () => {
      mockGithubExchange();
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        id: 'oauth-1',
        user: { id: 'user-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', isAdmin: false, isBanned: true },
      });

      await expect(service.loginWithGithub('auth-code')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('rejects an empty update', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: null });
      await expect(service.updateProfile('user-1', 'session-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates firstName/lastName without touching the password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'irrelevant' });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        firstName: 'Grace',
        lastName: 'Hopper',
        isAdmin: false,
      });

      const result = await service.updateProfile('user-1', 'session-1', { firstName: 'Grace', lastName: 'Hopper' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { firstName: 'Grace', lastName: 'Hopper' },
      });
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
      expect(result.firstName).toBe('Grace');
    });

    it('rejects a blank name', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash: 'irrelevant' });
      await expect(service.updateProfile('user-1', 'session-1', { firstName: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a password change with the wrong current password', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash });
      await expect(
        service.updateProfile('user-1', 'session-1', { currentPassword: 'wrong', newPassword: 'new-password-123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects a new password under 8 characters', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash });
      await expect(
        service.updateProfile('user-1', 'session-1', { currentPassword: 'the-real-password', newPassword: 'short' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('changes the password and kills every OTHER session, keeping the current one', async () => {
      const passwordHash = await hashPassword('the-real-password');
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', passwordHash });
      prisma.user.update.mockResolvedValue({ id: 'user-1', email: 'a@example.com', firstName: null, lastName: null, isAdmin: false });

      await service.updateProfile('user-1', 'current-session', {
        currentPassword: 'the-real-password',
        newPassword: 'brand-new-password',
      });

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', NOT: { id: 'current-session' } },
      });
    });
  });
});
