import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';

@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[],
  ) {}

  async get(userId: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { userId } });
    return this.present(link?.token ?? null);
  }

  // Creating twice rotates the token: the previous URL stops working immediately.
  async enable(userId: string) {
    const token = randomBytes(24).toString('hex');
    await this.prisma.shareLink.upsert({
      where: { userId },
      create: { userId, token },
      update: { token, createdAt: new Date() },
    });
    return this.present(token);
  }

  async disable(userId: string) {
    await this.prisma.shareLink.deleteMany({ where: { userId } });
  }

  // What anyone holding the link sees: only widgets the owner ticked as shared,
  // never their config (URLs/tokens), never private widgets, no email.
  async publicDashboard(token: string) {
    if (!/^[a-f0-9]{48}$/.test(token)) throw new NotFoundException('Not found');
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: { user: { select: { firstName: true, theme: true, widgetSkin: true } } },
    });
    if (!link) throw new NotFoundException('Not found');

    const rows = await this.prisma.widgetInstance.findMany({
      where: { userId: link.userId, shared: true },
      orderBy: { createdAt: 'asc' },
    });
    const widgets = rows
      .filter((w) => this.providers.find((p) => p.name === w.serviceName)?.widgets.find((d) => d.name === w.widgetName)?.shareable !== false)
      .map((w) => ({
        id: w.id,
        serviceName: w.serviceName,
        widgetName: w.widgetName,
        title: w.title,
        decoration: w.decoration,
        position: w.position,
        cachedData: w.cachedData,
        insight: w.aiEnabled ? w.insight : null,
        lastRefreshedAt: w.lastRefreshedAt,
      }));
    return { owner: { firstName: link.user.firstName }, theme: link.user.theme, widgetSkin: link.user.widgetSkin, widgets };
  }

  private present(token: string | null) {
    return { enabled: token !== null, token, path: token ? `/public/dashboard/${token}` : null };
  }
}
