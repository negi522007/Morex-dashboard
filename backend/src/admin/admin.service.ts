import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

// Told to the banned/unbanned user by email — they are never just silently cut off with no way to
// understand why or respond. Replying to this address reaches SMTP_FROM, which is read by a real person
// (there is no in-app appeal inbox — see FRONTEND.md's "Admin console" for why a full ticket/appeal
// workflow was judged out of scope for this project's size).
const BAN_TEXT: Record<string, { subject: string; body: (reason: string) => string }> = {
  en: { subject: 'Your Morex account has been suspended', body: (r) => `An administrator suspended your account. Reason given: "${r}".\n\nYou are logged out everywhere and cannot sign back in while suspended. If you think this is a mistake or want to explain your side, just reply to this email — a real person will read it.` },
  fr: { subject: 'Ton compte Morex a été suspendu', body: (r) => `Un administrateur a suspendu ton compte. Motif indiqué : « ${r} ».\n\nTu es déconnecté partout et ne peux pas te reconnecter tant que c'est suspendu. Si tu penses que c'est une erreur ou que tu veux t'expliquer, réponds simplement à cet email — une vraie personne le lira.` },
  es: { subject: 'Tu cuenta de Morex ha sido suspendida', body: (r) => `Un administrador suspendió tu cuenta. Motivo indicado: «${r}».\n\nSe cerró tu sesión en todas partes y no puedes volver a entrar mientras esté suspendida. Si crees que es un error o quieres explicarte, simplemente responde a este correo — una persona real lo leerá.` },
};
const UNBAN_TEXT: Record<string, { subject: string; body: string }> = {
  en: { subject: 'Your Morex account has been restored', body: 'An administrator lifted the suspension on your account. You can sign in again.' },
  fr: { subject: 'Ton compte Morex a été réactivé', body: 'Un administrateur a levé la suspension de ton compte. Tu peux te reconnecter.' },
  es: { subject: 'Tu cuenta de Morex ha sido restaurada', body: 'Un administrador levantó la suspensión de tu cuenta. Ya puedes volver a entrar.' },
};
// Sent right before the data is actually gone (see remove() below) — same reasoning as BAN_TEXT: never a
// silent account loss, always a reason and a real inbox to reply to. Unlike a ban, this can't be undone
// by an "unban" button once sent — honest about that, instead of implying a reversal that isn't real.
const DELETE_TEXT: Record<string, { subject: string; body: (reason: string) => string }> = {
  en: { subject: 'Your Morex account has been deleted', body: (r) => `An administrator permanently deleted your account and everything in it. Reason given: "${r}".\n\nThis cannot be undone from our side. If you think this is a mistake or want to explain your side, reply to this email — a real person will read it.` },
  fr: { subject: 'Ton compte Morex a été supprimé', body: (r) => `Un administrateur a supprimé définitivement ton compte et tout ce qu'il contenait. Motif indiqué : « ${r} ».\n\nCe n'est pas réversible de notre côté. Si tu penses que c'est une erreur ou que tu veux t'expliquer, réponds à cet email — une vraie personne le lira.` },
  es: { subject: 'Tu cuenta de Morex ha sido eliminada', body: (r) => `Un administrador eliminó permanentemente tu cuenta y todo su contenido. Motivo indicado: «${r}».\n\nEsto no se puede deshacer de nuestro lado. Si crees que es un error o quieres explicarte, responde a este correo — una persona real lo leerá.` },
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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
      banReason: u.banReason,
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
  // not "eventually, once their token expires." A reason is mandatory — a
  // ban with no stated reason is exactly the silent, unaccountable kind of
  // moderation this was built to avoid — and is emailed to the user along
  // with how to reply if they want to contest it (see BAN_TEXT above).
  async ban(userId: string, adminId: string, reason: string): Promise<void> {
    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) {
      throw new BadRequestException('A reason is required to suspend an account');
    }
    const target = await this.findUserOrThrow(userId);
    if (target.id === adminId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    if (target.isAdmin) {
      throw new BadRequestException('Cannot ban another admin');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isBanned: true, banReason: trimmedReason } }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);

    const t = BAN_TEXT[target.language] ?? BAN_TEXT.en;
    await this.mail.sendAlertEmail(target.email, t.subject, t.body(trimmedReason)).catch((err) =>
      this.logger.warn(`Could not email the ban notice to ${target.email}: ${(err as Error).message}`),
    );
  }

  async unban(userId: string): Promise<void> {
    const target = await this.findUserOrThrow(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { isBanned: false, banReason: null } });

    const t = UNBAN_TEXT[target.language] ?? UNBAN_TEXT.en;
    await this.mail.sendAlertEmail(target.email, t.subject, t.body).catch((err) =>
      this.logger.warn(`Could not email the unban notice to ${target.email}: ${(err as Error).message}`),
    );
  }

  // Permanent — cascades to sessions, widget instances, OAuth links, etc.
  // via the existing onDelete: Cascade relations. Banning is the
  // reversible option; this isn't. A reason is mandatory for the same
  // accountability reason as ban(), and is emailed before the data is gone
  // (see DELETE_TEXT) — the one way the user can still push back, even
  // though nothing here can actually restore the account afterwards.
  async remove(userId: string, adminId: string, reason: string): Promise<void> {
    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) {
      throw new BadRequestException('A reason is required to delete an account');
    }
    if (userId === adminId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const target = await this.findUserOrThrow(userId);
    if (target.isAdmin) {
      throw new BadRequestException('Cannot delete another admin');
    }

    const t = DELETE_TEXT[target.language] ?? DELETE_TEXT.en;
    await this.mail.sendAlertEmail(target.email, t.subject, t.body(trimmedReason)).catch((err) =>
      this.logger.warn(`Could not email the deletion notice to ${target.email}: ${(err as Error).message}`),
    );

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
