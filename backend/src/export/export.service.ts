import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WidgetsService } from '../widgets/widgets.service';
import { JournalService } from '../journal/journal.service';

// "Download my data" (GDPR right to data portability): everything Morex keeps about the user, as one JSON
// document. Secrets never leave the server: no password hash, no OAuth token, and secret widget settings
// (calendar URL, API keys…) stay masked as "********" exactly like GET /widgets. Fetched third-party data
// (a widget's cached weather, prices…) is not the user's own data, so it is left out too.
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly widgets: WidgetsService,
    private readonly journal: JournalService,
  ) {}

  async exportFor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const [widgets, journal, alerts, accounts] = await Promise.all([
      this.widgets.list(userId),
      this.journal.list(userId).catch(() => null), // null = journal can't be decrypted on this server
      this.prisma.alert.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { events: { orderBy: { at: 'asc' } } } }),
      this.prisma.oAuthAccount.findMany({ where: { userId }, select: { provider: true, profile: true } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      app: 'Morex',
      profile: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
        bio: user.bio,
        language: user.language,
        theme: user.theme,
        widgetSkin: user.widgetSkin,
        avatarConfig: user.avatarConfig,
        avatarPhotoUrl: user.avatarPhotoPath,
        hasPassword: !!user.passwordHash,
        createdAt: user.createdAt,
      },
      linkedAccounts: accounts.map((a) => ({ provider: a.provider, profile: a.profile ?? null })),
      widgets: widgets.map((w: any) => ({
        id: w.id,
        service: w.serviceName,
        widget: w.widgetName,
        title: w.title ?? null,
        config: w.config,
        refreshRateSeconds: w.refreshRateSeconds,
        decoration: w.decoration ?? null,
        position: w.position ?? null,
        createdAt: w.createdAt,
      })),
      journal,
      alerts: alerts.map((a) => ({
        widgetId: a.widgetId,
        label: a.label,
        operator: a.operator,
        threshold: a.threshold,
        cooldownMinutes: a.cooldownMinutes,
        active: a.active,
        createdAt: a.createdAt,
        events: a.events.map((e) => ({ at: e.at, value: e.value, message: e.message })),
      })),
    };
  }
}
