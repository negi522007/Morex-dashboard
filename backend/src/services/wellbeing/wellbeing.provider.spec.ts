import { ZODIAC_SIGNS } from '../../common/birth-date.util';
import { ServiceFetchError } from '../service-provider.interface';
import { DAY_THEME, FACTS, HORO_AREAS, QUOTES, SIGN_INFO, SIGN_TRAIT } from './data';
import { WellbeingController } from './wellbeing.controller';
import { WellbeingProvider } from './wellbeing.provider';

const provider = new WellbeingProvider();
const w = (n: string) => provider.widgets.find((x) => x.name === n)!;

describe('content library', () => {
  it('is complete in three languages, with an author on every quote and no duplicates', () => {
    for (const q of QUOTES) { expect(q.author).toBeTruthy(); expect(q.text.every((t) => t.length > 8)).toBe(true); }
    for (const f of FACTS) expect(f.text.every((t) => t.length > 25)).toBe(true);
    for (const t of DAY_THEME) expect(t.every((x) => x.length > 15)).toBe(true);
    for (const s of ZODIAC_SIGNS) { expect(SIGN_TRAIT[s].every((x) => x.length > 15)).toBe(true); expect(SIGN_INFO[s].name.every(Boolean)).toBe(true); }
    expect(new Set(QUOTES.map((q) => q.text[0])).size).toBe(QUOTES.length);
    expect(new Set(FACTS.map((f) => f.text[0])).size).toBe(FACTS.length);
  });
});

describe('WellbeingProvider', () => {
  it('is a free service with the three widgets', () => {
    expect(provider.name).toBe('wellbeing');
    expect(provider.requiresAuth).toBe(false);
    expect(provider.widgets.map((x) => x.name)).toEqual(['daily_quote', 'did_you_know', 'horoscope']);
  });

  it('daily_quote returns an attributed quote in every language, stable within the day', async () => {
    const a: any = await w('daily_quote').fetchData({});
    const b: any = await w('daily_quote').fetchData({});
    expect(a).toEqual(b);
    expect(a.author).toBeTruthy();
    expect(Object.keys(a.text)).toEqual(['en', 'fr', 'es']);
    expect(a.text.fr).not.toBe(a.text.en);
  });

  it('did_you_know returns a fact with its topic in every language', async () => {
    const f: any = await w('did_you_know').fetchData({});
    expect(f.topic).toMatch(/nature|space|science|history|tech|body/);
    expect(Object.values(f.text).every((t) => typeof t === 'string' && (t as string).length > 25)).toBe(true);
  });

  it('horoscope needs a valid sign, is labelled as library text, and differs by sign', async () => {
    await expect(w('horoscope').fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
    await expect(w('horoscope').fetchData({ sign: 'dragon' })).rejects.toThrow(/Unknown sign/);
    const a: any = await w('horoscope').fetchData({ sign: 'Aries' });
    const p: any = await w('horoscope').fetchData({ sign: 'pisces' });
    expect(a).toMatchObject({ sign: 'aries', source: 'library' });
    expect(a.text.en).toContain(SIGN_TRAIT.aries[0]);
    expect(a.disclaimer.en).toMatch(/entertainment/i);
    expect(a.text.en).not.toBe(p.text.en);
  });

  it('horoscope rates love, work and energy (2–5 stars, sentence matching the rating) and gives a lucky number and colour, stable within the day', async () => {
    const a: any = await w('horoscope').fetchData({ sign: 'capricorn' });
    const again: any = await w('horoscope').fetchData({ sign: 'capricorn' });
    expect(again).toEqual(a);
    for (const area of ['love', 'work', 'energy']) {
      const { stars, text } = a.areas[area];
      expect(stars).toBeGreaterThanOrEqual(2);
      expect(stars).toBeLessThanOrEqual(5);
      const level = stars <= 2 ? 'calm' : stars === 3 ? 'good' : 'great';
      expect(HORO_AREAS[area as 'love'][level].map((t) => t[0])).toContain(text.en);
      expect(Object.keys(text)).toEqual(['en', 'fr', 'es']);
    }
    expect(a.lucky.number).toBeGreaterThanOrEqual(1);
    expect(a.lucky.number).toBeLessThanOrEqual(99);
    expect(a.lucky.color.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(a.lucky.color.name.fr).toBeTruthy();
  });

  it('horoscope enrich: asks the model with the sign and date only, caches per sign+day+language', async () => {
    const data: any = await w('horoscope').fetchData({ sign: 'gemini' });
    const completeJson = jest.fn().mockResolvedValue({ text: 'Une journée calme et curieuse vous attend, prenez le temps d’écouter vos proches et d’avancer pas à pas.' });
    const set = jest.fn();
    const ctx: any = { userId: 'u', language: 'fr', config: { sign: 'gemini' }, ai: { available: true, completeJson }, cache: { get: jest.fn().mockResolvedValue(null), set } };
    const out: any = await w('horoscope').enrich!(data, ctx);
    expect(out).toMatchObject({ kind: 'horoscope', sign: 'gemini', source: 'ai', language: 'fr' });
    expect(completeJson.mock.calls[0][0].user).toBe(`<data>Sign: gemini. Date: ${data.forDate}.</data>`);
    expect(completeJson.mock.calls[0][0].system).toMatch(/Never predict illness/);
    expect(set).toHaveBeenCalledWith(`horoscope:gemini:${data.forDate}:fr`, expect.any(Object));
  });

  it('horoscope enrich reuses a shared cached text without calling the model, and ignores empty model output', async () => {
    const data: any = await w('horoscope').fetchData({ sign: 'leo' });
    const completeJson = jest.fn();
    const cachedCtx: any = { userId: 'u', language: 'en', config: {}, ai: { available: true, completeJson }, cache: { get: jest.fn().mockResolvedValue({ text: 'cached text' }), set: jest.fn() } };
    expect((await w('horoscope').enrich!(data, cachedCtx) as any).text).toBe('cached text');
    expect(completeJson).not.toHaveBeenCalled();
    const emptyCtx: any = { ...cachedCtx, ai: { available: true, completeJson: jest.fn().mockResolvedValue({ text: '' }) }, cache: { get: jest.fn().mockResolvedValue(null), set: jest.fn() } };
    expect(await w('horoscope').enrich!(data, emptyCtx)).toBeNull();
  });

  it('advertises the sign dropdown, and the endpoint lists all 12 signs in the requested language', () => {
    expect(w('horoscope').params[0]).toMatchObject({ name: 'sign', required: true, optionsUrl: '/services/wellbeing/signs' });
    const list = new WellbeingController().signs('fr');
    expect(list).toHaveLength(12);
    expect(list.find((s) => s.value === 'gemini')).toMatchObject({ label: 'Gémeaux', glyph: '♊' });
  });
});
