import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AiService, AiUnavailableError, UNTRUSTED_RULES, clip, languageName } from '../ai/ai.service';
import type { WidgetDefinition } from '../services/service-provider.interface';

const SNAPSHOT_MIN_GAP_MS = 5 * 60_000;
const SNAPSHOT_RETENTION_MS = 90 * 24 * 3600_000;
const INSIGHT_MIN_GAP_MS = 10 * 60_000;
const MAX_PARALLEL_INSIGHTS = 2;

export interface RefreshedInstance {
  id: string;
  userId: string;
  serviceName: string;
  widgetName: string;
  // Decrypted config — never persisted or logged from here.
  config: Record<string, string | number>;
  aiEnabled?: boolean;
  insightHash?: string | null;
  insightAt?: Date | string | null;
  title?: string | null;
}

const ALERT_TEXT: Record<string, { above: string; below: string; subject: string }> = {
  en: { above: '{name} is now {value}, above your threshold of {threshold}.', below: '{name} is now {value}, below your threshold of {threshold}.', subject: 'Dashboard alert: {name}' },
  fr: { above: '{name} vaut maintenant {value}, au-dessus de votre seuil de {threshold}.', below: '{name} vaut maintenant {value}, en dessous de votre seuil de {threshold}.', subject: 'Alerte Dashboard : {name}' },
  es: { above: '{name} vale ahora {value}, por encima de tu umbral de {threshold}.', below: '{name} vale ahora {value}, por debajo de tu umbral de {threshold}.', subject: 'Alerta del Dashboard: {name}' },
};

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

// Everything that happens *after* a widget's data was refreshed, kept out of
// TimerService so the scheduler stays a plain fetch-and-store loop: value
// history, threshold alerts, and the opt-in AI insight.
@Injectable()
export class RefreshHooksService {
  private readonly logger = new Logger(RefreshHooksService.name);
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly mail: MailService,
  ) {}

  async afterRefresh(inst: RefreshedInstance, widget: WidgetDefinition, data: unknown): Promise<void> {
    try {
      const metric = widget.primaryMetric?.(data);
      if (typeof metric === 'number' && Number.isFinite(metric)) {
        await this.recordSnapshot(inst.id, metric);
        await this.evaluateAlerts(inst, widget, metric);
      }
    } catch (err) {
      this.logger.warn(`Post-refresh hooks failed for ${inst.id}: ${(err as Error).message}`);
    }

    if (inst.aiEnabled && this.ai.available) {
      // Fire and forget: a slow model must never delay the scheduler tick.
      void this.refreshInsight(inst, widget, data).catch((err) =>
        this.logger.warn(`Insight failed for ${inst.id}: ${(err as Error).message}`),
      );
    }
  }

  async recordSnapshot(widgetId: string, value: number): Promise<void> {
    const last = await this.prisma.widgetSnapshot.findFirst({ where: { widgetId }, orderBy: { at: 'desc' } });
    if (last && Date.now() - last.at.getTime() < SNAPSHOT_MIN_GAP_MS) return;
    await this.prisma.widgetSnapshot.create({ data: { widgetId, value } });
    await this.prisma.widgetSnapshot.deleteMany({
      where: { widgetId, at: { lt: new Date(Date.now() - SNAPSHOT_RETENTION_MS) } },
    });
  }

  async evaluateAlerts(inst: RefreshedInstance, widget: WidgetDefinition, value: number): Promise<void> {
    const alerts = await this.prisma.alert.findMany({ where: { widgetId: inst.id, active: true } });
    if (alerts.length === 0) return;
    const user = await this.prisma.user.findUnique({
      where: { id: inst.userId },
      select: { email: true, language: true },
    });
    const text = ALERT_TEXT[user?.language ?? 'en'] ?? ALERT_TEXT.en;

    for (const alert of alerts) {
      const hit = alert.operator === 'above' ? value > alert.threshold : value < alert.threshold;
      if (!hit) continue;
      const cooled = !alert.lastTriggeredAt || Date.now() - alert.lastTriggeredAt.getTime() >= alert.cooldownMinutes * 60_000;
      if (!cooled) continue;

      const name = alert.label || inst.title || `${inst.serviceName}/${widget.name}`;
      const message = fill(alert.operator === 'above' ? text.above : text.below, { name, value, threshold: alert.threshold });
      await this.prisma.alertEvent.create({ data: { alertId: alert.id, value, message } });
      await this.prisma.alert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
      if (user?.email) {
        await this.mail.sendAlertEmail(user.email, fill(text.subject, { name }), message).catch((err) =>
          this.logger.warn(`Alert email failed: ${(err as Error).message}`),
        );
      }
    }
  }

  async refreshInsight(inst: RefreshedInstance, widget: WidgetDefinition, data: unknown): Promise<void> {
    if (this.inFlight.has(inst.id) || this.inFlight.size >= MAX_PARALLEL_INSIGHTS) return;
    const user = await this.prisma.user.findUnique({ where: { id: inst.userId }, select: { language: true } });
    const language = user?.language ?? 'en';

    const hash = createHash('sha256').update(JSON.stringify(data) + '|' + language).digest('hex');
    if (inst.insightHash === hash) return;
    const at = inst.insightAt ? new Date(inst.insightAt).getTime() : 0;
    if (Date.now() - at < INSIGHT_MIN_GAP_MS && inst.insightHash) return;

    this.inFlight.add(inst.id);
    try {
      const client = this.ai.forUser(inst.userId);
      const ctx = {
        userId: inst.userId,
        language,
        config: inst.config,
        ai: client,
        cache: {
          get: async <T>(key: string) => {
            const row = await this.prisma.contentDigest.findUnique({ where: { key } });
            return (row?.payload ?? null) as T | null;
          },
          set: async (key: string, value: unknown) => {
            await this.prisma.contentDigest.upsert({
              where: { key },
              create: { key, payload: value as object },
              update: { payload: value as object },
            });
          },
        },
      };
      const insight = widget.enrich
        ? await widget.enrich(data, ctx)
        : await this.genericInsight(inst, widget, data, client, language);
      if (insight == null) return;
      await this.prisma.widgetInstance.update({
        where: { id: inst.id },
        data: { insight: insight as object, insightAt: new Date(), insightHash: hash },
      });
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      // quota/disabled/failed: keep the previous insight; the raw data is unaffected.
    } finally {
      this.inFlight.delete(inst.id);
    }
  }

  private async genericInsight(
    inst: RefreshedInstance,
    widget: WidgetDefinition,
    data: unknown,
    ai: ReturnType<AiService['forUser']>,
    language: string,
  ) {
    const json = clip(JSON.stringify(data), 3000);
    const out = await ai.completeJson<{ headline?: string; detail?: string; tone?: string }>({
      system:
        `You turn a dashboard widget's raw data into one useful sentence for its owner, written in ${languageName(language)}. ` +
        `${UNTRUSTED_RULES} Schema: {"headline": string (max 90 chars, the single most useful takeaway), ` +
        `"detail": string (max 220 chars, context or advice), "tone": "good"|"neutral"|"warning"}. Do not invent numbers that are not in the data.`,
      user: `Widget: ${inst.serviceName}/${widget.name} (${widget.description})\n<data>${json}</data>`,
      maxTokens: 300,
      mock: { headline: `${inst.serviceName}/${widget.name}: data updated`, detail: clip(json, 120), tone: 'neutral' },
    });
    const tone = ['good', 'neutral', 'warning'].includes(out.tone ?? '') ? out.tone : 'neutral';
    return { kind: 'summary', headline: clip(out.headline ?? '', 90), detail: clip(out.detail ?? '', 220), tone, language };
  }
}
