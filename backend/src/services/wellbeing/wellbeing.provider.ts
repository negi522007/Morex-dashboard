import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { UNTRUSTED_RULES, clip, languageName } from '../../ai/ai.service';
import { ZODIAC_SIGNS, Zodiac } from '../../common/birth-date.util';
import { EnrichContext, ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';
import { DAY_THEME, DISCLAIMER, FACTS, L3, QUOTES, SIGN_TRAIT } from './data';

// The "Well-being" group: three small daily widgets. Everything is written once in three languages and the
// card shows the one matching the interface language, so no widget needs to know who is looking at it.
const today = () => new Date().toISOString().slice(0, 10);
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const pickIndex = (seed: string, n: number) => parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) % n;
const trio = (t: L3) => ({ en: t[0], fr: t[1], es: t[2] });
const LANG_INDEX = { en: 0, fr: 1, es: 2 } as const;

export interface HoroscopeData {
  sign: Zodiac;
  forDate: string;
  text: { en: string; fr: string; es: string };
  source: 'library';
  disclaimer: { en: string; fr: string; es: string };
}

const dailyQuote: WidgetDefinition = {
  name: 'daily_quote',
  description: 'A real, attributed quote for the day, in your language',
  params: [],
  async fetchData() {
    const date = today();
    const q = QUOTES[dayNumber(date) % QUOTES.length];
    return { date, author: q.author, text: trio(q.text) };
  },
};

const didYouKnow: WidgetDefinition = {
  name: 'did_you_know',
  description: 'A short, well-established fact for the day, in your language',
  params: [],
  async fetchData() {
    const date = today();
    // A different stride than the quote so the two never advance in lockstep.
    const f = FACTS[(dayNumber(date) * 7) % FACTS.length];
    return { date, topic: f.topic, text: trio(f.text) };
  },
};

// The base text is built from a fixed set of sentences (labelled "library"). With AI switched on for the
// widget, `insight` carries a freshly written horoscope for the sign only — never the birth date — shared by
// every user of that sign for the day.
const horoscope: WidgetDefinition = {
  name: 'horoscope',
  description: 'Daily horoscope for a zodiac sign, for fun — with an optional AI-written version',
  params: [{ name: 'sign', type: 'string', required: true, optionsUrl: '/services/wellbeing/signs' }],
  async fetchData(config): Promise<HoroscopeData> {
    const sign = String(config.sign ?? '').toLowerCase() as Zodiac;
    if (!ZODIAC_SIGNS.includes(sign)) {
      throw new ServiceFetchError('wellbeing', 'horoscope', `Unknown sign "${config.sign}" (use one of: ${ZODIAC_SIGNS.join(', ')})`);
    }
    const forDate = today();
    const theme = DAY_THEME[pickIndex(`${sign}|${forDate}`, DAY_THEME.length)];
    const text: L3 = [0, 1, 2].map((i) => `${SIGN_TRAIT[sign][i]} ${theme[i]}`) as L3;
    return { sign, forDate, text: trio(text), source: 'library', disclaimer: trio(DISCLAIMER) };
  },
  async enrich(data, ctx: EnrichContext) {
    const { sign, forDate } = data as HoroscopeData;
    const lang = ctx.language in LANG_INDEX ? (ctx.language as 'en' | 'fr' | 'es') : 'en';
    const key = `horoscope:${sign}:${forDate}:${lang}`;
    const cached = await ctx.cache.get<{ text: string }>(key);
    let text = cached?.text;
    if (!text) {
      const out = await ctx.ai.completeJson<{ text?: string }>({
        system:
          `You write a short, warm, positive daily horoscope for entertainment, in ${languageName(lang)}. ` +
          `${UNTRUSTED_RULES} Schema: {"text": string (50 to 80 words, second person, concrete and gentle)}. ` +
          'Never predict illness, death, accidents or money outcomes; never give medical, legal or financial advice; no fear.',
        user: `<data>Sign: ${sign}. Date: ${forDate}.</data>`,
        maxTokens: 300,
        mock: { text: (data as HoroscopeData).text[lang] },
      });
      text = clip(String(out.text ?? ''), 600);
      if (text.length < 20) return null;
      await ctx.cache.set(key, { text });
    }
    return { kind: 'horoscope', sign, forDate, text, source: 'ai', language: lang, disclaimer: DISCLAIMER[LANG_INDEX[lang]] };
  },
};

@Injectable()
export class WellbeingProvider implements ServiceProvider {
  name = 'wellbeing';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [dailyQuote, didYouKnow, horoscope];
}
