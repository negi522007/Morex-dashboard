import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiService, AiUnavailableError, UNTRUSTED_RULES, clip, languageName } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';
import { WidgetsService } from '../widgets/widgets.service';

const MAX_MESSAGE = 500;
const MAX_SUGGESTIONS = 4;
const MAX_HISTORY = 8;

interface Draft {
  serviceName?: string;
  widgetName?: string;
  title?: string;
  config?: Record<string, unknown>;
  reason?: string;
}
interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
interface ChatBody {
  prompt?: unknown;
  history?: unknown;
}

// Offline stand-in (AI_PROVIDER=mock) so the feature can be developed without a key. A short, vague
// message gets a clarifying question instead of a guess — the same behaviour the real model is told to have.
function mockChat(prompt: string): { reply: string; suggestions: Draft[] } {
  const p = prompt.toLowerCase();
  if (/bitcoin|btc|crypto/.test(p)) {
    return {
      reply: "Sure — here's a widget for that.",
      suggestions: [{ serviceName: 'market_data', widgetName: 'price_history', title: 'Bitcoin', config: { asset: 'bitcoin', days: 7 }, reason: 'Bitcoin price over the last week' }],
    };
  }
  if (/m[ée]t[ée]o|weather|temps/.test(p)) {
    return {
      reply: 'Got it, adding a weather card.',
      suggestions: [{ serviceName: 'weather', widgetName: 'daily_forecast', title: 'Weather', config: { city: 'Paris', days: 5 }, reason: 'Current weather and the next days' }],
    };
  }
  if (/news|actu|noticias|article/.test(p)) {
    return {
      reply: 'Here you go.',
      suggestions: [{ serviceName: 'rss', widgetName: 'article_list', title: 'Hacker News', config: { link: 'https://hnrss.org/frontpage', number: 5 }, reason: 'Top tech stories' }],
    };
  }
  return { reply: "What would you like to follow — news, a market, GitHub, the weather somewhere? Tell me a bit more.", suggestions: [] };
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly ai: AiService,
    private readonly widgets: WidgetsService,
    private readonly prisma: PrismaService,
    @Inject(SERVICE_PROVIDERS) private readonly providers: ServiceProvider[],
  ) {}

  private catalog() {
    return this.providers.flatMap((p) =>
      p.widgets.map((w) => ({
        serviceName: p.name,
        widgetName: w.name,
        description: w.description,
        params: w.params.filter((x) => !x.secret).map((x) => ({ name: x.name, type: x.type, required: Boolean(x.required) })),
      })),
    );
  }

  private cleanHistory(raw: unknown): ChatTurn[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m): m is ChatTurn => Boolean(m) && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: clip(m.content, 500) }));
  }

  // A real back-and-forth, not a one-shot command: the model can ask a clarifying question (`reply`
  // only, empty `suggestions`) before it has enough to act, and keeps the thread via `history`. It
  // never creates anything itself — every draft was already validated with the exact rules of
  // POST /widgets, so once the user confirms one, the frontend can post it as-is.
  async suggest(userId: string, body: ChatBody) {
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) throw new BadRequestException('prompt is required');
    if (prompt.length > MAX_MESSAGE) throw new BadRequestException(`prompt is limited to ${MAX_MESSAGE} characters`);
    const history = this.cleanHistory(body?.history);
    if (!this.ai.available) return { available: false, reply: '', suggestions: [] };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    const language = user?.language ?? 'en';

    let out: { reply?: string; suggestions?: Draft[] };
    try {
      out = await this.ai.forUser(userId).completeJson({
        system:
          `You are a friendly assistant chatting with the user to build dashboard widgets from the catalog below, ` +
          `writing every "reply"/"title"/"reason" in ${languageName(language)}. ${UNTRUSTED_RULES} ` +
          'This is a CONVERSATION, not a one-shot command: if the request is vague or you are missing a needed setting ' +
          '(e.g. which city, which repo, which channel), ask ONE short clarifying question in "reply" and leave ' +
          '"suggestions" empty — do not invent a placeholder value. Once you have enough, "reply" is a short, ' +
          'natural acknowledgement (not a report) and "suggestions" holds the widgets, picked from the catalog only ' +
          `(exact serviceName/widgetName/param names), at most ${MAX_SUGGESTIONS}. ` +
          'Never invent secrets, API keys or private URLs: omit any param you do not know. ' +
          'Schema: {"reply": string (max 220 chars), "suggestions":[{"serviceName": string, "widgetName": string, "title": string (max 40 chars), "config": object, "reason": string (max 120 chars)}]}.',
        user: `Catalog: ${JSON.stringify(this.catalog())}\n${history.length ? `<history>${JSON.stringify(history)}</history>\n` : ''}<data>${prompt}</data>`,
        maxTokens: 900,
        mock: mockChat(prompt),
      });
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        throw new BadRequestException(err.reason === 'quota' ? 'Daily AI quota reached' : 'The AI model could not answer, try again later');
      }
      throw err;
    }

    const suggestions: Record<string, unknown>[] = [];
    for (const d of (out.suggestions ?? []).slice(0, MAX_SUGGESTIONS)) {
      const def = this.providers.find((p) => p.name === d.serviceName)?.widgets.find((w) => w.name === d.widgetName);
      if (!def) continue;
      // Secrets are the user's to type: strip anything the model produced for them,
      // and validate with a placeholder so the draft is otherwise complete.
      const secretNames = def.params.filter((p) => p.secret).map((p) => p.name);
      const config: Record<string, unknown> = { ...(d.config ?? {}) };
      for (const s of secretNames) delete config[s];
      const forValidation = { ...config };
      for (const s of secretNames) forValidation[s] = 'placeholder';

      const checked = await this.widgets.validateDraft(userId, {
        serviceName: d.serviceName,
        widgetName: d.widgetName,
        config: forValidation,
      });
      if (!checked.ok) continue;
      suggestions.push({
        serviceName: checked.serviceName,
        widgetName: checked.widgetName,
        title: clip(d.title ?? '', 40) || null,
        config: Object.fromEntries(Object.entries(checked.config).filter(([k]) => !secretNames.includes(k))),
        refreshRateSeconds: checked.refreshRateSeconds,
        reason: clip(d.reason ?? '', 140),
        needsAccount: checked.needsAccount,
        missingSecrets: secretNames.filter((s) => !(s in config)),
      });
    }
    return { available: true, reply: clip(out.reply ?? '', 260), suggestions };
  }
}
