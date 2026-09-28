import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import { widgetNeedsAuth, type ServiceAuthContext, type ServiceProvider, type WidgetDefinition } from '../services/service-provider.interface';
import { decryptSecrets } from '../common/secret-config.util';
import { RefreshHooksService } from '../insights/refresh-hooks.service';
import { decryptToken } from '../common/token-encryption.util';

// Short enough that a widget is refreshed a few seconds after its countdown (shown on its card) ends
const TICK_MS = 5_000;
// Widgets refreshed at the same time: one slow or unreachable service no longer holds up everyone else's
const CONCURRENCY = 8;

interface DueWidgetInstance {
  id: string;
  userId: string;
  serviceName: string;
  widgetName: string;
  config: Record<string, string | number>;
  aiEnabled?: boolean;
  insightHash?: string | null;
  insightAt?: Date | null;
  title?: string | null;
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
    @Optional() private readonly hooks?: RefreshHooksService,
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
        SELECT id, "userId", "serviceName", "widgetName", config, "aiEnabled", "insightHash", "insightAt", title
        FROM "WidgetInstance"
        WHERE "lastRefreshedAt" IS NULL
           OR "lastRefreshedAt" + ("refreshRateSeconds" * INTERVAL '1 second') <= NOW()
      `;

      let next = 0;
      const worker = async () => {
        while (next < due.length) {
          const instance = due[next++];
          try {
            await this.refreshInstance(instance);
          } catch (err) {
            this.logger.error(`Refresh crashed for instance ${instance.id}: ${(err as Error).message}`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, due.length) }, worker));
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
      const needsAuth = widgetNeedsAuth(provider, widget);
      const auth = needsAuth ? await this.resolveAuth(instance.userId, instance.serviceName) : undefined;
      if (needsAuth && !auth) {
        // The account behind this widget was disconnected: stop reading the service and clear what was shown,
        // so the card asks to reconnect instead of silently going on. It resumes by itself once reconnected.
        await this.prisma.widgetInstance.update({
          where: { id: instance.id },
          data: { cachedData: Prisma.DbNull, lastRefreshedAt: new Date() },
        });
        return;
      }
      const config = this.decryptConfig(widget, instance.config);
      const data = await widget.fetchData(config, auth);
      await this.prisma.widgetInstance.update({
        where: { id: instance.id },
        data: { cachedData: data as object, lastRefreshedAt: new Date() },
      });
      await this.hooks?.afterRefresh({ ...instance, config }, widget, data);
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

  private decryptConfig(widget: WidgetDefinition, config: Record<string, string | number>) {
    if (!widget.params.some((p) => p.secret)) return config;
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is required to read secret widget parameters');
    return decryptSecrets(widget.params, config, key) as Record<string, string | number>;
  }

  private async resolveAuth(userId: string, serviceName: string): Promise<ServiceAuthContext | undefined> {
    const encryptionKey = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!encryptionKey) return undefined;

    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider: serviceName },
    });
    if (oauthAccount) {
      return {
        accessToken: decryptToken(oauthAccount.accessTokenEncrypted, encryptionKey),
        profile: (oauthAccount.profile as Record<string, unknown> | null) ?? undefined,
      };
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
