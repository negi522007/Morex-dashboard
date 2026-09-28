import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { hashPassword, verifyPassword } from './password.util';
import { encryptToken } from '../common/token-encryption.util';
import { UPLOADS_DIR } from '../common/uploads.util';
import { Zodiac, parseBirthDate, toIsoDate, zodiacOf } from '../common/birth-date.util';

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

export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// How long an address that said "not me" stays closed to password sign-ups.
const REJECT_BLOCK_MS = 24 * 60 * 60 * 1000;
// How long to wait before an unconfirmed address may sign up again.
const RESIGNUP_COOLDOWN_MS = 2 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The mockup's own option sets (mockups.html's [data-theme]/T dictionaries) —
// validated server-side so a bad value can't get stored and silently break
// the theme system client-side.
export const THEMES = ['galaxy', 'aurora', 'moon', 'dolphins', 'forest', 'mystic', 'ocean', 'beach', 'desertNight', 'desertMoon'] as const;
export const LANGUAGES = ['fr', 'en', 'es'] as const;
export const WIDGET_SKINS = ['glass', 'neon', 'pastel', 'minimal', 'holo'] as const;

export interface PublicUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  createdAt: Date;
  bio: string | null;
  theme: string;
  language: string;
  widgetSkin: string;
  avatarConfig: unknown;
  avatarPhotoUrl: string | null;
  // "YYYY-MM-DD" or null; the sign is derived from it (see the well-being page).
  birthDate: string | null;
  zodiac: Zodiac | null;
}

// "ada.lovelace@gmail.com" → "a***@gmail.com": enough to recognise it, not enough to leak it to whoever holds the link.
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  createdAt: Date;
  bio: string | null;
  theme: string;
  language: string;
  widgetSkin: string;
  avatarConfig: unknown;
  avatarPhotoPath: string | null;
  birthDate?: Date | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    bio: user.bio,
    theme: user.theme,
    language: user.language,
    widgetSkin: user.widgetSkin,
    avatarConfig: user.avatarConfig,
    avatarPhotoUrl: user.avatarPhotoPath,
    birthDate: user.birthDate ? toIsoDate(user.birthDate) : null,
    zodiac: user.birthDate ? zodiacOf(user.birthDate) : null,
  };
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
  async register(email: string, password: string, firstName: string, lastName: string, birthDate?: Date | null, lang: 'en' | 'fr' | 'es' = 'en') {
    const blocked = await this.prisma.blockedEmail.findUnique({ where: { email } });
    if (blocked && blocked.until > new Date()) {
      throw new ConflictException(
        'This address recently asked not to receive sign-up emails. Try again later, or sign in with GitHub / My Epitech',
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // A signup that was never confirmed can't be used to log in, so it must not
      // lock the address: the real owner may retry (e.g. the first mail never
      // arrived). The old, unconfirmed row is replaced. The short cooldown stops
      // this from being used to spam someone's inbox with confirmation mails.
      const unconfirmed = existing.emailVerified === false && !existing.isBanned;
      if (!unconfirmed) {
        throw new ConflictException('An account with this email already exists');
      }
      if (Date.now() - new Date(existing.createdAt).getTime() < RESIGNUP_COOLDOWN_MS) {
        throw new ConflictException(
          'A confirmation email was just sent to this address — check your inbox (and spam), or try again in a few minutes',
        );
      }
      await this.prisma.user.delete({ where: { id: existing.id } });
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
        birthDate: birthDate ?? null,
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
      await this.mail.sendConfirmationEmail(email, `${appUrl}/auth/confirm?token=${token}`, lang, firstName);
    } catch (err) {
      // Don't leave an unconfirmable, unretryable account behind if the
      // email never went out — the cascade delete also removes the token.
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new ServiceUnavailableException('Could not send the confirmation email, please try again');
    }

    return toPublicUser(user);
  }

  // The link in the email opens a page that *asks* (it must not act on a plain GET: mail scanners
  // and link previews open links automatically). These are the three calls behind that page.
  private async findPending(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { token }, include: { user: true } });
    return record && !record.user.emailVerified ? record : null;
  }

  // Shows who the account is for without changing anything ("is this you?").
  async previewConfirmation(token: string): Promise<{ email: string; firstName: string | null; expiresAt: Date }> {
    const record = await this.findPending(token);
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired confirmation link');
    }
    return { email: maskEmail(record.user.email), firstName: record.user.firstName, expiresAt: record.expiresAt };
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

  // "This wasn't me": someone used this address. The pending account is deleted (nothing was ever
  // active) and the address is blocked from password sign-ups for a day so it can't be mailed again.
  async rejectConfirmation(token: string): Promise<void> {
    const record = await this.findPending(token);
    if (!record) throw new UnauthorizedException('Invalid or expired confirmation link');
    await this.prisma.$transaction([
      this.prisma.user.delete({ where: { id: record.userId } }),
      this.prisma.blockedEmail.upsert({
        where: { email: record.user.email },
        create: { email: record.user.email, until: new Date(Date.now() + REJECT_BLOCK_MS) },
        update: { until: new Date(Date.now() + REJECT_BLOCK_MS) },
      }),
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

  // The other end of linkGithubAccount/loginWithGithub. Blocked when GitHub
  // is the user's ONLY way in (no passwordHash) — since "Sign in with
  // GitHub" now exists, unlinking a passwordless account would otherwise
  // lock them out with no recovery path. Revoking from GitHub's own side
  // (Settings > Applications) still works regardless; this just makes OUR
  // side agree with that instead of holding a dead, undeletable token.
  async unlinkGithubAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: 'github' },
    });
    if (!account) {
      throw new NotFoundException('No linked GitHub account for this user');
    }

    if (!user.passwordHash) {
      throw new ConflictException(
        'This account has no password — unlinking GitHub would lock you out. Set a password first.',
      );
    }

    await this.prisma.oAuthAccount.delete({ where: { id: account.id } });
    // Its widgets stop right away: nothing is shown until GitHub is connected again
    await this.prisma.widgetInstance.updateMany({
      where: { userId, serviceName: 'github' },
      data: { cachedData: Prisma.DbNull, insight: Prisma.DbNull, lastRefreshedAt: null },
    });
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

  // Used only by GET /auth/me: the frontend has no other way to know
  // whether the current user has a GitHub account linked (needed to show
  // "Link" vs "Unlink" instead of always "Link"). Not folded into
  // toPublicUser/PublicUser itself, since register/login/getUserBySession
  // don't need the extra query this requires.
  async hasLinkedGithub(userId: string): Promise<boolean> {
    const account = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider: 'github' } });
    return account !== null;
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
    updates: {
      firstName?: string;
      lastName?: string;
      currentPassword?: string;
      newPassword?: string;
      bio?: string;
      theme?: string;
      language?: string;
      widgetSkin?: string;
      avatarConfig?: unknown;
      birthDate?: string | null;
    },
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const data: {
      firstName?: string;
      lastName?: string;
      passwordHash?: string;
      bio?: string;
      theme?: string;
      language?: string;
      widgetSkin?: string;
      avatarConfig?: any;
      birthDate?: Date | null;
    } = {};

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
    if (updates.bio !== undefined) {
      if (updates.bio.length > 280) throw new BadRequestException('Bio must be 280 characters or fewer');
      data.bio = updates.bio;
    }
    if (updates.theme !== undefined) {
      if (!THEMES.includes(updates.theme as (typeof THEMES)[number])) {
        throw new BadRequestException(`theme must be one of: ${THEMES.join(', ')}`);
      }
      data.theme = updates.theme;
    }
    if (updates.language !== undefined) {
      if (!LANGUAGES.includes(updates.language as (typeof LANGUAGES)[number])) {
        throw new BadRequestException(`language must be one of: ${LANGUAGES.join(', ')}`);
      }
      data.language = updates.language;
    }
    if (updates.widgetSkin !== undefined) {
      if (!WIDGET_SKINS.includes(updates.widgetSkin as (typeof WIDGET_SKINS)[number])) {
        throw new BadRequestException(`widgetSkin must be one of: ${WIDGET_SKINS.join(', ')}`);
      }
      data.widgetSkin = updates.widgetSkin;
    }
    if (updates.avatarConfig !== undefined) {
      data.avatarConfig = updates.avatarConfig;
    }
    if (updates.birthDate !== undefined) {
      data.birthDate = updates.birthDate === null || updates.birthDate === '' ? null : parseBirthDate(updates.birthDate);
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
      throw new BadRequestException('Nothing to update: provide at least one field to change');
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });

    if (killOtherSessions) {
      await this.prisma.session.deleteMany({ where: { userId, NOT: { id: currentSessionId } } });
    }

    return toPublicUser(updated);
  }

  // Deletes the file behind a previous /uploads/... path, if any — best
  // effort, so a missing/already-gone file never breaks the actual update.
  private async deleteUploadedFile(publicPath: string | null): Promise<void> {
    if (!publicPath) return;
    try {
      await unlink(join(UPLOADS_DIR, publicPath.replace(/^\/uploads\//, '')));
    } catch {
      // Already gone, or never existed — nothing to do.
    }
  }

  // A newly uploaded photo replaces any previous one (old file removed).
  // avatarConfig (the DiceBear option object) is intentionally left
  // untouched — switching back from a photo just needs removeAvatarPhoto,
  // not re-picking every option.
  async setAvatarPhoto(userId: string, publicPath: string): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { avatarPhotoPath: publicPath } });
    await this.deleteUploadedFile(existing?.avatarPhotoPath ?? null);
    return toPublicUser(updated);
  }

  async removeAvatarPhoto(userId: string): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { avatarPhotoPath: null } });
    await this.deleteUploadedFile(existing?.avatarPhotoPath ?? null);
    return toPublicUser(updated);
  }
}
