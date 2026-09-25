import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';

export interface AlertBody {
  widgetId?: string;
  operator?: string;
  threshold?: number;
  cooldownMinutes?: number;
  label?: string | null;
  active?: boolean;
}

const MAX_ALERTS_PER_USER = 50;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[],
  ) {}

  list(userId: string) {
    return this.prisma.alert.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, body: AlertBody) {
    const widget = await this.prisma.widgetInstance.findFirst({ where: { id: body.widgetId ?? '', userId } });
    if (!widget) throw new NotFoundException('Widget instance not found');
    const def = this.providers.find((p) => p.name === widget.serviceName)?.widgets.find((w) => w.name === widget.widgetName);
    if (!def?.primaryMetric) throw new BadRequestException('This widget has no numeric value to watch');

    const operator = this.operator(body.operator);
    const threshold = this.threshold(body.threshold);
    if ((await this.prisma.alert.count({ where: { userId } })) >= MAX_ALERTS_PER_USER) {
      throw new BadRequestException(`You can have at most ${MAX_ALERTS_PER_USER} alerts`);
    }
    return this.prisma.alert.create({
      data: {
        userId,
        widgetId: widget.id,
        operator,
        threshold,
        cooldownMinutes: this.cooldown(body.cooldownMinutes ?? 60),
        label: this.label(body.label),
        active: body.active ?? true,
      },
    });
  }

  async update(userId: string, id: string, body: AlertBody) {
    const existing = await this.prisma.alert.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Alert not found');
    const data: Record<string, unknown> = {};
    if (body.operator !== undefined) data.operator = this.operator(body.operator);
    if (body.threshold !== undefined) data.threshold = this.threshold(body.threshold);
    if (body.cooldownMinutes !== undefined) data.cooldownMinutes = this.cooldown(body.cooldownMinutes);
    if (body.label !== undefined) data.label = this.label(body.label);
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
      // Re-arming an alert: it may fire again right away if the condition still holds.
      if (body.active) data.lastTriggeredAt = null;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update');
    return this.prisma.alert.update({ where: { id }, data });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.alert.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Alert not found');
    await this.prisma.alert.delete({ where: { id } });
  }

  async events(userId: string, limit = 30) {
    const take = Math.min(Math.max(Math.floor(Number(limit)) || 30, 1), 100);
    const rows = await this.prisma.alertEvent.findMany({
      where: { alert: { userId } },
      orderBy: { at: 'desc' },
      take,
      include: { alert: { select: { id: true, widgetId: true, label: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      at: r.at,
      value: r.value,
      message: r.message,
      alertId: r.alert.id,
      widgetId: r.alert.widgetId,
      label: r.alert.label,
    }));
  }

  private operator(v: unknown): 'above' | 'below' {
    if (v !== 'above' && v !== 'below') throw new BadRequestException('operator must be "above" or "below"');
    return v;
  }
  private threshold(v: unknown): number {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new BadRequestException('threshold must be a number');
    return n;
  }
  private cooldown(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1 || n > 10_080) throw new BadRequestException('cooldownMinutes must be between 1 and 10080');
    return Math.floor(n);
  }
  private label(v: unknown): string | null {
    if (v === undefined || v === null || v === '') return null;
    return String(v).slice(0, 80);
  }
}
