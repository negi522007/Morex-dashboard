import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, AiUnavailableError, UNTRUSTED_RULES, clip, languageName } from '../ai/ai.service';

const MAX_WIDGETS = 12;

export interface BriefContent {
  headline: string;
  items: { widgetId: string; text: string }[];
  tip: string;
}

@Injectable()
export class BriefService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  async get(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    const language = user?.language ?? 'en';
    const row = await this.prisma.brief.findUnique({ where: { userId_day_language: { userId, day: this.today(), language } } });
    return {
      available: this.ai.available,
      brief: row ? { ...(row.content as unknown as BriefContent), generatedAt: row.generatedAt, language } : null,
    };
  }

  // Only widgets the user switched AI on for are read — the same opt-in as the
  // per-widget insight. The journal is never part of it.
  async refresh(userId: string) {
    if (!this.ai.available) throw new BadRequestException('AI is not configured on this server');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true, firstName: true } });
    const language = user?.language ?? 'en';

    const widgets = await this.prisma.widgetInstance.findMany({
      where: { userId, aiEnabled: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_WIDGETS,
    });
    const usable = widgets.filter((w) => w.cachedData !== null);
    if (usable.length === 0) throw new BadRequestException('Turn AI on for at least one widget (with data) to get a brief');

    const payload = usable.map((w) => ({
      id: w.id,
      widget: w.title || `${w.serviceName}/${w.widgetName}`,
      data: clip(JSON.stringify(w.cachedData), 700),
    }));
    const valid = new Set(payload.map((p) => p.id));

    let out: { headline?: string; items?: { id?: string; text?: string }[]; tip?: string };
    try {
      out = await this.ai.forUser(userId).completeJson({
        system:
          `You write a short morning briefing for a personal dashboard owner, in ${languageName(language)}. ${UNTRUSTED_RULES} ` +
          'Schema: {"headline": string (max 120 chars, the day in one sentence), ' +
          '"items": [{"id": string (a widget id from the input), "text": string (max 140 chars, the one thing to know)}] (max 6, most important first), ' +
          '"tip": string (max 140 chars, one actionable suggestion, or empty)}. Use only numbers present in the data.',
        user: `<data>${JSON.stringify(payload)}</data>`,
        maxTokens: 700,
        mock: {
          headline: `${usable.length} widget(s) to watch today`,
          items: payload.slice(0, 6).map((p) => ({ id: p.id, text: p.widget })),
          tip: '',
        },
      });
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        throw new BadRequestException(err.reason === 'quota' ? 'Daily AI quota reached' : 'The AI model could not answer, try again later');
      }
      throw err;
    }

    const content: BriefContent = {
      headline: clip(out.headline ?? '', 130),
      items: (out.items ?? [])
        .filter((i) => typeof i.id === 'string' && valid.has(i.id) && typeof i.text === 'string')
        .slice(0, 6)
        .map((i) => ({ widgetId: i.id as string, text: clip(i.text as string, 150) })),
      tip: clip(out.tip ?? '', 150),
    };
    const day = this.today();
    const row = await this.prisma.brief.upsert({
      where: { userId_day_language: { userId, day, language } },
      create: { userId, day, language, content: content as object },
      update: { content: content as object, generatedAt: new Date() },
    });
    return { available: true, brief: { ...content, generatedAt: row.generatedAt, language } };
  }
}
