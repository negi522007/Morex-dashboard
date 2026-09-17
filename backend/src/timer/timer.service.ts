import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceAuthContext, ServiceProvider } from '../services/service-provider.interface';
import { decryptToken } from '../common/token-encryption.util';

const TICK_MS = 15_000;

interface DueWidgetInstance {
  id: string;
  userId: string;
  serviceName: string;
  widgetName: string;
  config: Record<string, string | number>;
}

@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);
  // Guards against a slow tick (e.g. a hanging external API) overlapping
  // with the next one — cheap, and the only real risk at this scale.
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[],
  ) {}

  @Interval(TICK_MS)
  async handleTick(): Promise<void> {
    if (this.ticking) {
      this.logger.warn('Previous tick still running, skipping this one');
      return;
    }
    this.ticking = true;
    try {
      const due = await this.prisma.$queryRaw<DueWidgetInstance[]>`
        SELECT id, "userId", "serviceName", "widgetName", config
        FROM "WidgetInstance"
        WHERE "lastRefreshedAt" IS NULL
           OR "lastRefreshedAt" + ("refreshRateSeconds" * INTERVAL '1 second') <= NOW()
      `;

      for (const instance of due) {
        await this.refreshInstance(instance);
      }
    } finally {
      this.ticking = false;
    }
  }

  private async refreshInstance(instance: DueWidgetInstance): Promise<void> {
    const provider = this.providers.find((p) => p.name === instance.serviceName);
    const widget = provider?.widgets.find((w) => w.name === instance.widgetName);

    if (!provider || !widget) {
      this.logger.error(
        `Unknown service/widget for instance ${instance.id}: ${instance.serviceName}/${instance.widgetName}`,
      );
      // Still push lastRefreshedAt so a permanently-unknown widget doesn't
      // get re-selected on every single tick.
      await this.prisma.widgetInstance.update({
        where: { id: instance.id },
        data: { lastRefreshedAt: new Date() },
      });
      return;
    }

    try {
      const auth = provider.requiresAuth ? await this.resolveAuth(instance.userId, instance.serviceName) : undefined;
      const data = await widget.fetchData(instance.config, auth);
      await this.prisma.widgetInstance.update({
        where: { id: instance.id },
        data: { cachedData: data as object, lastRefreshedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Refresh failed for instance ${instance.id} (${instance.serviceName}/${instance.widgetName}): ${(err as Error).message}`,
      );
      // Keep the last known-good cachedData untouched — the frontend keeps
      // showing stale-but-real data instead of nothing. Only push the next
      // attempt back by refreshRateSeconds, so a broken API isn't hammered
      // every tick.
      await this.prisma.widgetInstance.update({
        where: { id: instance.id },
        data: { lastRefreshedAt: new Date() },
      });
    }
  }

  private async resolveAuth(userId: string, serviceName: string): Promise<ServiceAuthContext | undefined> {
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) return undefined;

    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: serviceName },
    });
    if (oauthAccount) {
      return { accessToken: decryptToken(oauthAccount.accessTokenEncrypted, encryptionKey) };
    }

    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { userId_serviceName: { userId, serviceName } },
    });
    if (subscription?.credentialsEncrypted) {
      return { credentials: JSON.parse(decryptToken(subscription.credentialsEncrypted, encryptionKey)) };
    }

    return undefined;
  }
}
