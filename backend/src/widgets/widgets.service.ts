import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import { widgetNeedsAuth, type ServiceProvider, type WidgetDefinition } from '../services/service-provider.interface';
import { encryptSecrets, maskSecrets } from '../common/secret-config.util';

// Below the scheduler's own 15s tick, a lower refresh rate is meaningless —
// it would just get picked up on the next available tick anyway. This is a
// sanity floor, not a real-time guarantee.
const MIN_REFRESH_SECONDS = 10;

export interface WidgetBody {
  serviceName?: string;
  widgetName?: string;
  config?: Record<string, unknown>;
  refreshRateSeconds?: number;
  position?: Record<string, unknown>;
  title?: string | null;
  decoration?: string | null;
  aiEnabled?: boolean;
  shared?: boolean;
}

// On update, a required secret param that the client left out (or sent as the
// mask) must not fail validation — the stored one is kept.
function mergeSecretPlaceholders(widget: WidgetDefinition, incoming: Record<string, unknown>, stored: Record<string, unknown>) {
  const merged = { ...incoming };
  for (const p of widget.params) {
    if (p.secret && (merged[p.name] === undefined || merged[p.name] === '********') && stored?.[p.name] !== undefined) {
      merged[p.name] = '********';
    }
  }
  return merged;
}

function validateConfig(widget: WidgetDefinition, rawConfig: unknown): Record<string, string | number> {
  const config = (rawConfig ?? {}) as Record<string, unknown>;
  const result: Record<string, string | number> = {};

  for (const param of widget.params) {
    const value = config[param.name];
    if (value === undefined || value === null || value === '') {
      if (param.required) {
        throw new BadRequestException(`Missing required parameter "${param.name}"`);
      }
      continue;
    }
    if (param.type === 'integer') {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        throw new BadRequestException(`Parameter "${param.name}" must be an integer`);
      }
      result[param.name] = n;
    } else {
      result[param.name] = String(value);
    }
  }

  return result;
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[],
    private readonly config: ConfigService,
  ) {}

  // What the API shows for a stored instance: secret params masked, and the
  // internal bookkeeping (the hash the insight was made from) left out.
  present<T extends { serviceName: string; widgetName: string; config: unknown }>(instance: T) {
    const { insightHash: _hash, ...rest } = instance as T & { insightHash?: unknown };
    let params: WidgetDefinition['params'] = [];
    try {
      params = this.findWidgetDefinition(instance.serviceName, instance.widgetName).widget.params;
    } catch {
      // service removed since — nothing to mask
    }
    return { ...rest, config: maskSecrets(params, (instance.config ?? {}) as Record<string, unknown>) };
  }

  private encryptionKey(needed: boolean): string {
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!key && needed) throw new ServiceUnavailableException('Secret parameters need TOKEN_ENCRYPTION_KEY on the server');
    return key ?? '';
  }

  async list(userId: string) {
    const rows = await this.prisma.widgetInstance.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.present(r));
  }

  // Everything create() checks, without saving: used by the AI assistant to
  // propose widgets that are guaranteed to be accepted when the user confirms.
  async validateDraft(userId: string, body: WidgetBody): Promise<
    { ok: true; serviceName: string; widgetName: string; config: Record<string, string | number>; refreshRateSeconds: number; needsAccount: string | null } |
    { ok: false; error: string }
  > {
    try {
      if (!body.serviceName || !body.widgetName) throw new BadRequestException('serviceName and widgetName are required');
      const { provider, widget } = this.findWidgetDefinition(body.serviceName, body.widgetName);
      const config = validateConfig(widget, body.config);
      const refreshRateSeconds = this.validateRefreshRate(body.refreshRateSeconds ?? 300);
      const needsAccount = widgetNeedsAuth(provider, widget) && !(await this.hasCredentials(userId, provider.name)) ? provider.name : null;
      return { ok: true, serviceName: provider.name, widgetName: widget.name, config, refreshRateSeconds, needsAccount };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async create(userId: string, body: WidgetBody) {
    if (!body.serviceName || !body.widgetName) {
      throw new BadRequestException('serviceName and widgetName are required');
    }
    const { provider, widget } = this.findWidgetDefinition(body.serviceName, body.widgetName);
    const config = validateConfig(widget, body.config);
    const refreshRateSeconds = this.validateRefreshRate(body.refreshRateSeconds);

    if (widgetNeedsAuth(provider, widget) && !(await this.hasCredentials(userId, provider.name))) {
      throw new BadRequestException(
        `You must connect your ${provider.name} account before adding a widget from this service`,
      );
    }
    if (body.shared && widget.shareable === false) {
      throw new BadRequestException('This widget shows private data and cannot be shared');
    }
    const hasSecrets = widget.params.some((p) => p.secret);
    const stored = hasSecrets ? encryptSecrets(widget.params, config, null, this.encryptionKey(true)) : config;

    const created = await this.prisma.widgetInstance.create({
      data: {
        userId,
        serviceName: provider.name,
        widgetName: widget.name,
        config: stored as Prisma.InputJsonValue,
        refreshRateSeconds,
        position: (body.position ?? {}) as Prisma.InputJsonValue,
        title: body.title ?? null,
        decoration: body.decoration ?? null,
        aiEnabled: body.aiEnabled ?? false,
        shared: body.shared ?? false,
      },
    });
    return this.present(created);
  }

  async update(userId: string, id: string, body: WidgetBody) {
    const existing = await this.prisma.widgetInstance.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException('Widget instance not found');
    }

    const data: Prisma.WidgetInstanceUpdateInput = {};
    const { widget } = this.findWidgetDefinition(existing.serviceName, existing.widgetName);

    if (body.config !== undefined) {
      const validated = validateConfig(widget, mergeSecretPlaceholders(widget, body.config, existing.config as Record<string, unknown>));
      const hasSecrets = widget.params.some((p) => p.secret);
      data.config = (hasSecrets
        ? encryptSecrets(widget.params, validated, existing.config as Record<string, unknown>, this.encryptionKey(true))
        : validated) as Prisma.InputJsonValue;
      // New settings: refresh on the next scheduler tick instead of waiting for the full refresh rate
      data.lastRefreshedAt = null;
    }
    if (body.refreshRateSeconds !== undefined) {
      data.refreshRateSeconds = this.validateRefreshRate(body.refreshRateSeconds);
    }
    if (body.position !== undefined) {
      data.position = body.position as Prisma.InputJsonValue;
    }
    if (body.title !== undefined) {
      data.title = body.title;
    }
    if (body.decoration !== undefined) {
      data.decoration = body.decoration;
    }
    if (body.shared !== undefined) {
      if (body.shared && widget.shareable === false) {
        throw new BadRequestException('This widget shows private data and cannot be shared');
      }
      data.shared = body.shared;
    }
    if (body.aiEnabled !== undefined) {
      data.aiEnabled = body.aiEnabled;
      if (body.aiEnabled) {
        // Turning it on: refresh on the next scheduler tick so the insight appears without waiting.
        data.insightHash = null;
        data.lastRefreshedAt = null;
      } else {
        data.insight = Prisma.DbNull;
        data.insightAt = null;
        data.insightHash = null;
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Nothing to update: provide config, refreshRateSeconds, position, title, decoration, aiEnabled, and/or shared',
      );
    }

    return this.present(await this.prisma.widgetInstance.update({ where: { id: existing.id }, data }));
  }

  // Value history of the widget's primary metric (see WidgetDefinition.primaryMetric).
  // Evenly thinned to at most `points` samples so a chart never gets thousands of them.
  async history(userId: string, id: string, days = 7, points = 200) {
    const existing = await this.prisma.widgetInstance.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Widget instance not found');

    const { widget } = this.findWidgetDefinition(existing.serviceName, existing.widgetName);
    if (!widget.primaryMetric) return { widgetId: id, supported: false, days: 0, points: [] };

    const d = Math.min(Math.max(Math.floor(Number(days)) || 7, 1), 90);
    const cap = Math.min(Math.max(Math.floor(Number(points)) || 200, 2), 1000);
    const rows = await this.prisma.widgetSnapshot.findMany({
      where: { widgetId: id, at: { gte: new Date(Date.now() - d * 86_400_000) } },
      orderBy: { at: 'asc' },
    });
    const step = rows.length > cap ? rows.length / cap : 1;
    const picked: typeof rows = [];
    for (let i = 0; i < rows.length; i += step) picked.push(rows[Math.floor(i)]);
    if (rows.length && picked[picked.length - 1] !== rows[rows.length - 1]) picked.push(rows[rows.length - 1]);
    return {
      widgetId: id,
      supported: true,
      days: d,
      points: picked.map((r) => ({ at: r.at.toISOString(), value: r.value })),
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.widgetInstance.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException('Widget instance not found');
    }
    await this.prisma.widgetInstance.delete({ where: { id: existing.id } });
  }

  private findWidgetDefinition(
    serviceName: string,
    widgetName: string,
  ): { provider: ServiceProvider; widget: WidgetDefinition } {
    const provider = this.providers.find((p) => p.name === serviceName);
    if (!provider) {
      throw new BadRequestException(`Unknown service "${serviceName}"`);
    }
    const widget = provider.widgets.find((w) => w.name === widgetName);
    if (!widget) {
      throw new BadRequestException(`Unknown widget "${widgetName}" for service "${serviceName}"`);
    }
    return { provider, widget };
  }

  private validateRefreshRate(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < MIN_REFRESH_SECONDS) {
      throw new BadRequestException(`refreshRateSeconds must be a number >= ${MIN_REFRESH_SECONDS}`);
    }
    return n;
  }

  private async hasCredentials(userId: string, serviceName: string): Promise<boolean> {
    const oauth = await this.prisma.oAuthAccount.findFirst({ where: { userId, provider: serviceName } });
    if (oauth) return true;

    const subscription = await this.prisma.serviceSubscription.findUnique({
      where: { userId_serviceName: { userId, serviceName } },
    });
    return Boolean(subscription);
  }
}
