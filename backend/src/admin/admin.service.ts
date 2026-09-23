import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { widgetInstances: true, oauthAccounts: true, sessions: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      emailVerified: u.emailVerified,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      createdAt: u.createdAt,
      widgetCount: u._count.widgetInstances,
      linkedAccountsCount: u._count.oauthAccounts,
      // Includes expired-but-not-yet-deleted rows — an approximation of
      // "how many sessions", not a live "currently logged in" count.
      sessionCount: u._count.sessions,
    }));
  }

  // Blocks login immediately AND kills every existing session in the same
  // transaction — this is the whole reason sessions were chosen over JWT
  // (ARCHITECTURE.md): a banned user is logged out everywhere instantly,
  // not "eventually, once their token expires."
  async ban(userId: string, adminId: string): Promise<void> {
    const target = await this.findUserOrThrow(userId);
    if (target.id === adminId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    if (target.isAdmin) {
      throw new BadRequestException('Cannot ban another admin');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isBanned: true } }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
  }

  async unban(userId: string): Promise<void> {
    await this.findUserOrThrow(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: false } });
  }

  // Permanent — cascades to sessions, widget instances, OAuth links, etc.
  // via the existing onDelete: Cascade relations. Banning is the
  // reversible option; this isn't.
  async remove(userId: string, adminId: string): Promise<void> {
    if (userId === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const target = await this.findUserOrThrow(userId);
    if (target.isAdmin) {
      throw new BadRequestException('Cannot delete another admin');
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // Name and a manual emailVerified override only — never email (same
  // "needs its own re-verification flow" reasoning as the user's own
  // PATCH /auth/me) and never password (an admin silently setting
  // someone's password is a bigger footgun than the convenience is worth;
  // isAdmin/isBanned already have their own dedicated, guarded endpoints
  // and deliberately aren't editable through this generic one). The
  // emailVerified override is real, requested-in-practice value: it
  // unblocks a user whose confirmation email never arrived, without
  // needing a "resend confirmation" flow to exist yet.
  async updateUser(
    userId: string,
    updates: { firstName?: string; lastName?: string; emailVerified?: boolean },
  ) {
    await this.findUserOrThrow(userId);

    const data: { firstName?: string; lastName?: string; emailVerified?: boolean } = {};
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
    if (updates.emailVerified !== undefined) {
      data.emailVerified = updates.emailVerified;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update: provide firstName, lastName, and/or emailVerified');
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data });
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      emailVerified: updated.emailVerified,
      isAdmin: updated.isAdmin,
      isBanned: updated.isBanned,
    };
  }

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
