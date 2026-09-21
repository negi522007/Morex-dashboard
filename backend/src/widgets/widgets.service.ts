import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider, WidgetDefinition } from '../services/service-provider.interface';

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
  ) {}

  list(userId: string) {
    return this.prisma.widgetInstance.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, body: WidgetBody) {
    if (!body.serviceName || !body.widgetName) {
      throw new BadRequestException('serviceName and widgetName are required');
    }
    const { provider, widget } = this.findWidgetDefinition(body.serviceName, body.widgetName);
    const config = validateConfig(widget, body.config);
    const refreshRateSeconds = this.validateRefreshRate(body.refreshRateSeconds);

    if (provider.requiresAuth && !(await this.hasCredentials(userId, provider.name))) {
      throw new BadRequestException(
        `You must connect your ${provider.name} account before adding a widget from this service`,
      );
    }

    return this.prisma.widgetInstance.create({
      data: {
        userId,
        serviceName: provider.name,
        widgetName: widget.name,
        config,
        refreshRateSeconds,
        position: (body.position ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async update(userId: string, id: string, body: WidgetBody) {
    const existing = await this.prisma.widgetInstance.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException('Widget instance not found');
    }

    const data: Prisma.WidgetInstanceUpdateInput = {};

    if (body.config !== undefined) {
      const { widget } = this.findWidgetDefinition(existing.serviceName, existing.widgetName);
      data.config = validateConfig(widget, body.config);
    }
    if (body.refreshRateSeconds !== undefined) {
      data.refreshRateSeconds = this.validateRefreshRate(body.refreshRateSeconds);
    }
    if (body.position !== undefined) {
      data.position = body.position as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update: provide config, refreshRateSeconds, and/or position');
    }

    return this.prisma.widgetInstance.update({ where: { id: existing.id }, data });
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
