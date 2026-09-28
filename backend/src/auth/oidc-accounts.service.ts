import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { encryptToken } from '../common/token-encryption.util';
import { SESSION_TTL_MS } from './auth.service';

export interface OidcGrant {
  // The provider's stable id for the person (never the email).
  subject: string;
  accessToken: string;
  refreshToken: string | null;
  // Non-secret facts shown back to the user.
  profile: object;
}

export interface OidcIdentity {
  email: string | null;
  // Only true when the provider itself vouches for the address.
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
}

// What every "sign in with…" provider needs once the protocol part is done: link to a logged-in user,
// log in / create an account, unlink, read the stored profile. The user for `link` always comes from
// the session, never from anything the provider returns.
@Injectable()
export class OidcAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private tokens(grant: OidcGrant) {
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY') as string;
    return {
      accessTokenEncrypted: encryptToken(grant.accessToken, key),
      refreshTokenEncrypted: grant.refreshToken ? encryptToken(grant.refreshToken, key) : null,
      profile: grant.profile,
    };
  }

  async link(provider: string, label: string, userId: string, grant: OidcGrant): Promise<void> {
    const existing = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: grant.subject } },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException(`This ${label} account is already linked to another user`);
    }
    const data = this.tokens(grant);
    if (existing) {
      await this.prisma.oAuthAccount.update({ where: { id: existing.id }, data });
      return;
    }
    // One account per provider and platform user: replace a previous link.
    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider } });
    await this.prisma.oAuthAccount.create({ data: { provider, providerAccountId: grant.subject, userId, ...data } });
  }

  // Known account → log in; same verified email as a local account → attach to it; otherwise create the account.
  async login(provider: string, label: string, grant: OidcGrant, identity: OidcIdentity): Promise<{ id: string; expiresAt: Date }> {
    const tokens = this.tokens(grant);
    const account = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: grant.subject } },
      include: { user: true },
    });
    let user;
    if (account) {
      user = account.user;
      await this.prisma.oAuthAccount.update({ where: { id: account.id }, data: tokens });
    } else {
      const email = identity.email?.toLowerCase();
      if (!email || !identity.emailVerified) {
        throw new BadRequestException(`Your ${label} account has no verified email address to sign in with`);
      }
      user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        const adminEmails = (this.config.get<string>('ADMIN_EMAILS') ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
        user = await this.prisma.user.create({
          data: {
            email,
            firstName: identity.firstName ?? email.split('@')[0],
            lastName: identity.lastName ?? email.split('@')[0],
            emailVerified: true,
            isAdmin: adminEmails.includes(email),
          },
        });
      }
      await this.prisma.oAuthAccount.create({ data: { provider, providerAccountId: grant.subject, userId: user.id, ...tokens } });
    }
    if (user.isBanned) throw new ForbiddenException('This account has been suspended');
    return this.prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  }

  async unlink(provider: string, label: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const account = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider } });
    if (!user || !account) throw new NotFoundException(`No linked ${label} account for this user`);
    // Never remove the last way to log in.
    const other = await this.prisma.oAuthAccount.findFirst({ where: { userId, NOT: { provider } } });
    if (!user.passwordHash && !other) {
      throw new ConflictException(`This account has no password — unlinking ${label} would lock you out. Set a password first.`);
    }
    await this.prisma.oAuthAccount.delete({ where: { id: account.id } });
  }

  async profileOf<T>(provider: string, userId: string): Promise<T | null> {
    const account = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider } });
    return account ? ((account.profile as unknown as T | null) ?? null) : null;
  }
}
