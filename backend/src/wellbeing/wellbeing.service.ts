import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiService, AiUnavailableError, UNTRUSTED_RULES, clip, languageName } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { Zodiac, ZODIAC_SIGNS, toIsoDate, zodiacOf } from '../common/birth-date.util';
import { BREATHING, DAY_THEME, L3, QUOTES, SIGN_TRAIT, TIPS } from './data';

type Lang = 'en' | 'fr' | 'es';
const LI: Record<Lang, number> = { en: 0, fr: 1, es: 2 };
const asLang = (v: unknown): Lang => (v === 'fr' || v === 'es' ? v : 'en');

// Stable pseudo-random number for (a string): the same input gives the same pick all day.
const pick = (seed: string, n: number) => parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) % n;
const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export interface Horoscope {
  sign: Zodiac;
  forDate: string;
  text: string;
  // "ai" = written by the model for this sign and day; "library" = built from a fixed set of sentences.
  source: 'ai' | 'library';
  disclaimer: string;
}

const DISCLAIMER: Record<Lang, string> = {
  en: 'For entertainment only — not advice.',
  fr: 'Pour le plaisir uniquement — pas un conseil.',
  es: 'Solo por entretenimiento — no es un consejo.',
};

@Injectable()
export class WellbeingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  quote(dateIso: string, lang: Lang, offset = 0) {
    const i = (((dayNumber(dateIso) + offset) % QUOTES.length) + QUOTES.length) % QUOTES.length;
    const q = QUOTES[i];
    return { text: q.text[LI[lang]], author: q.author, original: q.text[0] };
  }

  tip(dateIso: string, lang: Lang) {
    const t = TIPS[dayNumber(dateIso) % TIPS.length];
    return { category: t.category, text: t.text[LI[lang]] };
  }

  breathingList(lang: Lang) {
    return BREATHING.map((b) => ({ id: b.id, name: b.name[LI[lang]], steps: b.steps, rounds: b.rounds, why: b.why[LI[lang]] }));
  }

  // The horoscope is identical for everyone of a sign on a given day, so it is generated once per
  // (sign, day, language) and shared — 36 model calls a day at most, whatever the number of users.
  async horoscope(userId: string, sign: Zodiac, dateIso: string, lang: Lang): Promise<Horoscope> {
    const key = `horoscope:${sign}:${dateIso}:${lang}`;
    const cached = await this.prisma.contentDigest.findUnique({ where: { key } });
    if (cached) return cached.payload as unknown as Horoscope;

    let result: Horoscope | null = null;
    if (this.ai.available) {
      try {
        const out = await this.ai.forUser(userId).completeJson<{ text?: string }>({
          system:
            `You write a short, warm, positive daily horoscope for entertainment, in ${languageName(lang)}. ` +
            `${UNTRUSTED_RULES} Schema: {"text": string (50 to 80 words, second person, concrete and gentle)}. ` +
            'Never predict illness, death, accidents or money outcomes; never give medical, legal or financial advice; no fear.',
          user: `<data>Sign: ${sign}. Date: ${dateIso}.</data>`,
          maxTokens: 300,
          mock: { text: SIGN_TRAIT[sign][LI[lang]] },
        });
        const text = clip(String(out.text ?? ''), 600);
        if (text.length > 20) result = { sign, forDate: dateIso, text, source: 'ai', disclaimer: DISCLAIMER[lang] };
      } catch (err) {
        if (!(err instanceof AiUnavailableError)) throw err;
      }
    }
    if (!result) {
      const theme = DAY_THEME[pick(`${sign}|${dateIso}`, DAY_THEME.length)];
      result = { sign, forDate: dateIso, text: `${SIGN_TRAIT[sign][LI[lang]]} ${theme[LI[lang]]}`, source: 'library', disclaimer: DISCLAIMER[lang] };
    }
    // Only real AI text is worth sharing; the library version is instant to rebuild.
    if (result.source === 'ai') {
      await this.prisma.contentDigest.upsert({ where: { key }, create: { key, payload: result as object }, update: { payload: result as object } });
    }
    return result;
  }

  // Only the mood and the date of journal entries are read — never their text (which is encrypted).
  async moods(userId: string, todayIso: string) {
    const since = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 13 * 86_400_000);
    const rows = await this.prisma.journalEntry.findMany({
      where: { userId, date: { gte: since } },
      select: { date: true, mood: true },
      orderBy: { date: 'asc' },
    });
    const byDay = new Map<string, string>();
    const counts: Record<string, number> = {};
    for (const r of rows) {
      byDay.set(toIsoDate(r.date), r.mood);
      counts[r.mood] = (counts[r.mood] ?? 0) + 1;
    }
    let streak = 0;
    for (let d = dayNumber(todayIso); byDay.has(new Date(d * 86_400_000).toISOString().slice(0, 10)); d--) streak++;
    return { days: [...byDay].map(([date, mood]) => ({ date, mood })), counts, streak };
  }

  async today(userId: string, langHint?: string, offset = 0) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { language: true, birthDate: true } });
    const lang = asLang(langHint ?? user?.language);
    const date = new Date().toISOString().slice(0, 10);
    const sign = user?.birthDate ? zodiacOf(user.birthDate) : null;
    return {
      date,
      language: lang,
      quote: this.quote(date, lang, offset),
      tip: this.tip(date, lang),
      breathing: this.breathingList(lang),
      horoscope: sign ? await this.horoscope(userId, sign, date, lang) : null,
      // true when the user has no birth date yet: show "add your birth date in your profile to unlock it".
      needsBirthDate: !sign,
      mood: await this.moods(userId, date),
    };
  }
}

export { ZODIAC_SIGNS };
