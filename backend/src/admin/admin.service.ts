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

  private async findUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
