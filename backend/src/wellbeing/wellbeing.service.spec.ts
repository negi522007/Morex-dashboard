import { AiUnavailableError } from '../ai/ai.service';
import { ZODIAC_SIGNS } from '../common/birth-date.util';
import { BREATHING, DAY_THEME, QUOTES, SIGN_TRAIT, TIPS } from './data';
import { WellbeingService } from './wellbeing.service';

function make(opts: { available?: boolean; answer?: any; throwWith?: Error; user?: any; cached?: any; entries?: any[] } = {}) {
  const completeJson = jest.fn(async (a: any) => {
    if (opts.throwWith) throw opts.throwWith;
    return opts.answer ?? a.mock;
  });
  const ai: any = { available: opts.available ?? true, forUser: () => ({ available: true, completeJson }) };
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(opts.user ?? { language: 'en', birthDate: null }) },
    contentDigest: { findUnique: jest.fn().mockResolvedValue(opts.cached ?? null), upsert: jest.fn() },
    journalEntry: { findMany: jest.fn().mockResolvedValue(opts.entries ?? []) },
  };
  return { svc: new WellbeingService(prisma, ai), prisma, completeJson };
}

describe('content library', () => {
  it('is complete in three languages, with authors on every quote', () => {
    for (const q of QUOTES) { expect(q.author).toBeTruthy(); expect(q.text.every((t) => t.length > 8)).toBe(true); }
    for (const t of TIPS) expect(t.text.every((x) => x.length > 15)).toBe(true);
    for (const t of DAY_THEME) expect(t.every((x) => x.length > 15)).toBe(true);
    for (const s of ZODIAC_SIGNS) expect(SIGN_TRAIT[s].every((x) => x.length > 15)).toBe(true);
    for (const b of BREATHING) { expect(b.steps.length).toBeGreaterThan(1); expect(b.name.every(Boolean)).toBe(true); }
  });
});

describe('WellbeingService', () => {
  it('picks the same quote and tip all day, and "another quote" moves on', () => {
    const { svc } = make();
    expect(svc.quote('2026-09-26', 'en')).toEqual(svc.quote('2026-09-26', 'en'));
    expect(svc.quote('2026-09-26', 'en', 1).text).not.toBe(svc.quote('2026-09-26', 'en').text);
    expect(svc.quote('2026-09-26', 'fr').text).not.toBe(svc.quote('2026-09-26', 'en').text);
    expect(svc.tip('2026-09-26', 'es')).toEqual(svc.tip('2026-09-26', 'es'));
  });

  it('has no horoscope and asks for a birth date when the user gave none — without calling the model', async () => {
    const { svc, completeJson } = make();
    const t = await svc.today('u');
    expect(t).toMatchObject({ horoscope: null, needsBirthDate: true, language: 'en' });
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('writes the horoscope with the model for the sign only (never the birth date), and shares it', async () => {
    const { svc, prisma, completeJson } = make({ answer: { text: 'A calm, focused day is ahead of you. Take one thing at a time and it will go well.' } });
    const h = await svc.horoscope('u', 'gemini', '2026-09-26', 'fr');
    expect(h).toMatchObject({ sign: 'gemini', source: 'ai', forDate: '2026-09-26' });
    const call = completeJson.mock.calls[0][0];
    expect(call.user).toBe('<data>Sign: gemini. Date: 2026-09-26.</data>');
    expect(call.system).toMatch(/French/);
    expect(call.system).toMatch(/Never predict illness/);
    expect(prisma.contentDigest.upsert.mock.calls[0][0].where.key).toBe('horoscope:gemini:2026-09-26:fr');
  });

  it('reuses a shared horoscope instead of calling the model again', async () => {
    const cached = { payload: { sign: 'leo', forDate: 'd', text: 'cached', source: 'ai', disclaimer: 'x' } };
    const { svc, completeJson } = make({ cached });
    expect((await svc.horoscope('u', 'leo', '2026-09-26', 'en')).text).toBe('cached');
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('falls back to the labelled library text when AI is off or failing — stable for the day, different by sign', async () => {
    for (const m of [make({ available: false }), make({ throwWith: new AiUnavailableError('quota', 'x') })]) {
      const a = await m.svc.horoscope('u', 'aries', '2026-09-26', 'en');
      expect(a.source).toBe('library');
      expect(a.text).toContain(SIGN_TRAIT.aries[0]);
      expect(a.disclaimer).toMatch(/entertainment/i);
      expect(await m.svc.horoscope('u', 'aries', '2026-09-26', 'en')).toEqual(a);
      expect((await m.svc.horoscope('u', 'pisces', '2026-09-26', 'en')).text).not.toBe(a.text);
      expect(m.prisma.contentDigest.upsert).not.toHaveBeenCalled();
    }
  });

  it('computes the sign from the stored birth date and answers in the user language', async () => {
    const { svc } = make({ user: { language: 'fr', birthDate: new Date('2000-05-21T00:00:00Z') }, available: false });
    const t: any = await svc.today('u');
    expect(t.horoscope).toMatchObject({ sign: 'gemini', source: 'library' });
    expect(t).toMatchObject({ needsBirthDate: false, language: 'fr' });
    expect(t.breathing[0].name).toBe('Respiration carrée');
  });

  it('summarises moods from the journal without ever selecting the text', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { svc, prisma } = make({ entries: [
      { date: new Date(`${yesterday}T00:00:00Z`), mood: '🙂' }, { date: new Date(`${today}T00:00:00Z`), mood: '🙂' }, { date: new Date('2000-01-01T00:00:00Z'), mood: '😢' },
    ] });
    const m = await svc.moods('u', today);
    expect(m.streak).toBe(2);
    expect(m.counts['🙂']).toBe(2);
    expect(prisma.journalEntry.findMany.mock.calls[0][0].select).toEqual({ date: true, mood: true });
  });
});
