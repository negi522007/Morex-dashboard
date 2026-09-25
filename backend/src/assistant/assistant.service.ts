import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiService, AiUnavailableError, UNTRUSTED_RULES, clip, languageName } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { SERVICE_PROVIDERS } from '../services/service-providers.token';
import type { ServiceProvider } from '../services/service-provider.interface';
import { WidgetsService } from '../widgets/widgets.service';

const MAX_PROMPT = 500;
const MAX_SUGGESTIONS = 4;

interface Draft {
  serviceName?: string;
  widgetName?: string;
  title?: string;
  config?: Record<string, unknown>;
  reason?: string;
}

// Offline stand-in (AI_PROVIDER=mock) so the feature can be developed without a key.
function mockDrafts(prompt: string): { suggestions: Draft[] } {
  const p = prompt.toLowerCase();
  if (/bitcoin|btc|crypto/.test(p)) {
    return { suggestions: [{ serviceName: 'market_data', widgetName: 'price_history', title: 'Bitcoin', config: { asset: 'bitcoin', days: 7 }, reason: 'Bitcoin price over the last week' }] };
  }
  if (/m[ée]t[ée]o|weather|temps/.test(p)) {
    return { suggestions: [{ serviceName: 'weather', widgetName: 'forecast', title: 'Weather', config: { city: 'Paris' }, reason: 'Current weather and forecast' }] };
  }
  return { suggestions: [{ serviceName: 'rss', widgetName: 'article_list', title: 'Hacker News', config: { link: 'https://hnrss.org/frontpage', number: 5 }, reason: 'Top tech stories' }] };
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

  // Suggests widgets from a sentence. It never creates anything: every draft was
  // already validated with the exact rules of POST /widgets, so once the user
  // confirms, the frontend can post it as-is.
  async suggest(userId: string, rawPrompt: unknown) {
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
    if (!prompt) throw new BadRequestException('prompt is required');
    if (prompt.length > MAX_PROMPT) throw new BadRequestException(`prompt is limited to ${MAX_PROMPT} characters`);
    if (!this.ai.available) return { available: false, suggestions: [] };

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    const language = user?.language ?? 'en';

    let out: { suggestions?: Draft[] };
    try {
      out = await this.ai.forUser(userId).completeJson({
        system:
          `You configure dashboard widgets from a user's request, and write titles and reasons in ${languageName(language)}. ${UNTRUSTED_RULES} ` +
          `Pick at most ${MAX_SUGGESTIONS} widgets from the catalog only (exact serviceName/widgetName/param names). ` +
          'Never invent secrets, API keys or private URLs: omit any param you do not know. ' +
          'Schema: {"suggestions":[{"serviceName": string, "widgetName": string, "title": string (max 40 chars), "config": object, "reason": string (max 120 chars)}]}.',
        user: `Catalog: ${JSON.stringify(this.catalog())}\n<data>${prompt}</data>`,
        maxTokens: 900,
        mock: mockDrafts(prompt),
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
    return { available: true, suggestions };
  }
}
