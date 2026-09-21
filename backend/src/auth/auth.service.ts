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
}

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

function toPublicUser(user: { id: string; email: string; firstName: string | null; lastName: string | null }): PublicUser {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // firstName/lastName are optional and editable later — there is no
  // profile-edit endpoint yet, so for now this is the only way to set them.
  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, firstName: firstName || null, lastName: lastName || null },
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

  // Links a GitHub account to an ALREADY authenticated user (userId comes
  // from the session, never from anything GitHub returns) — this is
  // authorization for the widget, not an alternate login path. The unique
  // constraint on (provider, providerAccountId) is what stops one GitHub
  // account from being linked to two different platform users; we check it
  // explicitly rather than upserting, so a re-link attempt by a different
  // user fails loudly instead of silently reassigning ownership.
  async linkGithubAccount(userId: string, code: string): Promise<void> {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const clientSecret = this.config.get<string>('GITHUB_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GITHUB_OAUTH_CALLBACK_URL');
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
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
    const providerAccountId = String(profile.id);
    const accessTokenEncrypted = encryptToken(tokenData.access_token, encryptionKey);

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
}
