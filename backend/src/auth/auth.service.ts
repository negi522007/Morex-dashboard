import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password.util';
import { encryptToken } from '../common/token-encryption.util';

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
}

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
}): PublicUser {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // firstName/lastName are required — enforced in AuthController, not here,
  // consistent with how email/password validation is also controller-side.
  async register(email: string, password: string, firstName: string, lastName: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        isAdmin: adminEmails.includes(email.toLowerCase()),
      },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:8080';
    try {
      await this.mail.sendConfirmationEmail(email, `${appUrl}/auth/confirm?token=${token}`);
    } catch (err) {
      // Don't leave an unconfirmable, unretryable account behind if the
      // email never went out — the cascade delete also removes the token.
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new ServiceUnavailableException('Could not send the confirmation email, please try again');
    }

    return toPublicUser(user);
  }

  async confirmEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired confirmation link');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
      this.prisma.emailVerificationToken.delete({ where: { token } }),
    ]);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBanned) {
      throw new ForbiddenException('This account has been suspended');
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('Please confirm your email before logging in');
    }

    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });

    return { session, user: toPublicUser(user) };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  // Shared by both GitHub flows (link and login): exchange the OAuth `code`
  // for an access token, then fetch the profile it belongs to. Throws
  // BadRequestException on any failure — both callers want that.
  private async exchangeGithubCode(code: string): Promise<{ accessToken: string; profile: GithubProfile }> {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GITHUB_OAUTH_CALLBACK_URL');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('GitHub OAuth is not configured on the server');
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as GithubTokenResponse;
    if (!tokenData.access_token) {
      throw new BadRequestException(
        `GitHub did not return an access token (${tokenData.error_description ?? tokenData.error ?? 'unknown error'})`,
      );
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'dashboard-app' },
    });
    if (!profileRes.ok) {
      throw new BadRequestException('Could not fetch the GitHub profile for this token');
    }
    const profile = (await profileRes.json()) as GithubProfile;
    return { accessToken: tokenData.access_token, profile };
  }

  // GitHub only returns `email` on the profile itself when the user has made
  // it public. `user:email` (already in our scope) grants the dedicated
  // /user/emails endpoint instead, which is the only reliable way to get a
  // verified address — and "verified" matters here: we're about to trust
  // this email enough to log someone into an existing account.
  private async fetchVerifiedGithubEmail(accessToken: string): Promise<string | null> {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'dashboard-app' },
    });
    if (!res.ok) return null;
    const emails = (await res.json()) as GithubEmail[];
    const verified = emails.filter((e) => e.verified);
    return (verified.find((e) => e.primary) ?? verified[0])?.email ?? null;
  }

  // Links a GitHub account to an ALREADY authenticated user (userId comes
  // from the session, never from anything GitHub returns) — this is
  // authorization for the widget, not an alternate login path. The unique
  // constraint on (provider, providerAccountId) is what stops one GitHub
  // account from being linked to two different platform users; we check it
  // explicitly rather than upserting, so a re-link attempt by a different
  // user fails loudly instead of silently reassigning ownership.
  async linkGithubAccount(userId: string, code: string): Promise<void> {
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new ServiceUnavailableException('GitHub OAuth is not configured on the server');
    }
    const { accessToken, profile } = await this.exchangeGithubCode(code);
    const providerAccountId = String(profile.id);
    const accessTokenEncrypted = encryptToken(accessToken, encryptionKey);

    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'github', providerAccountId } },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException('This GitHub account is already linked to another user');
    }

    if (existing) {
      await this.prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: { accessTokenEncrypted },
      });
    } else {
      await this.prisma.oAuthAccount.create({
        data: { provider: 'github', providerAccountId, userId, accessTokenEncrypted },
      });
    }
  }

  // "Sign in with GitHub": unlike linkGithubAccount, this needs no existing
  // session — it establishes one. Three cases, in order:
  //  1. This GitHub account is already linked to a platform user -> log
  //     them in.
  //  2. It isn't, but its verified email matches an existing local account
  //     -> link it to that account and log them in (never create a second
  //     User for the same real person).
  //  3. Neither -> register a brand new account. emailVerified is set to
  //     true immediately: GitHub already verified this address, so making
  //     the user click a second confirmation link would just be friction
  //     with no added trust.
  async loginWithGithub(code: string): Promise<{ session: { id: string; expiresAt: Date }; user: PublicUser }> {
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) {
      throw new ServiceUnavailableException('GitHub OAuth is not configured on the server');
    }
    const { accessToken, profile } = await this.exchangeGithubCode(code);
    const providerAccountId = String(profile.id);
    const accessTokenEncrypted = encryptToken(accessToken, encryptionKey);

    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider: 'github', providerAccountId } },
      include: { user: true },
    });

    let user;
    if (existingAccount) {
      user = existingAccount.user;
      await this.prisma.oAuthAccount.update({
        where: { id: existingAccount.id },
        data: { accessTokenEncrypted },
      });
    } else {
      const verifiedEmail = await this.fetchVerifiedGithubEmail(accessToken);
      if (!verifiedEmail) {
        throw new BadRequestException('Your GitHub account has no verified email address to sign in with');
      }

      const existingUser = await this.prisma.user.findUnique({ where: { email: verifiedEmail } });
      if (existingUser) {
        user = existingUser;
      } else {
        const nameParts = (profile.name ?? profile.login).trim().split(/\s+/).filter(Boolean);
        const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '')
          .split(',')
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        user = await this.prisma.user.create({
          data: {
            email: verifiedEmail,
            firstName: nameParts[0] ?? profile.login,
            lastName: nameParts.slice(1).join(' ') || profile.login,
            emailVerified: true,
            isAdmin: adminEmails.includes(verifiedEmail.toLowerCase()),
          },
        });
      }

      await this.prisma.oAuthAccount.create({
        data: { provider: 'github', providerAccountId, userId: user.id, accessTokenEncrypted },
      });
    }

    if (user.isBanned) {
      throw new ForbiddenException('This account has been suspended');
    }

    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });

    return { session, user: toPublicUser(user) };
  }

  async getUserBySession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    return toPublicUser(session.user);
  }

  // Self-service profile edit. Email change is deliberately out of scope —
  // it needs its own re-verification flow (confirm the NEW address before
  // switching) to avoid an easy account-lockout/takeover footgun, which is
  // enough extra machinery to be its own feature, not a field on this one.
  // Changing the password kills every OTHER session (not the one making
  // this request) — same reasoning as admin ban: a password change should
  // invalidate access anyone else still has, immediately.
  async updateProfile(
    userId: string,
    currentSessionId: string,
    updates: { firstName?: string; lastName?: string; currentPassword?: string; newPassword?: string },
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const data: { firstName?: string; lastName?: string; passwordHash?: string } = {};

    if (updates.firstName !== undefined) {
      const trimmed = updates.firstName.trim();
      if (!trimmed) throw new BadRequestException('First name cannot be blank');
      data.firstName = trimmed;
    }
    if (updates.lastName !== undefined) {
      const trimmed = updates.lastName.trim();
      if (!trimmed) throw new BadRequestException('Last name cannot be blank');
      data.lastName = trimmed;
    }

    let killOtherSessions = false;
    if (updates.newPassword !== undefined) {
      if (!updates.currentPassword || !user.passwordHash || !(await verifyPassword(updates.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      if (updates.newPassword.length < 8) {
        throw new BadRequestException('New password must be at least 8 characters');
      }
      data.passwordHash = await hashPassword(updates.newPassword);
      killOtherSessions = true;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update: provide firstName, lastName, and/or newPassword (with currentPassword)');
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    if (killOtherSessions) {
      await this.prisma.session.deleteMany({ where: { userId, NOT: { id: currentSessionId } } });
    }

    return toPublicUser(updated);
  }
}
