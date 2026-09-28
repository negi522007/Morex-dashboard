import { YoutubeCountriesController } from './youtube-countries.controller';

describe('YoutubeCountriesController', () => {
  const ctrl = new YoutubeCountriesController();

  it('returns every country by default, named in the requested language, sorted', () => {
    const fr = ctrl.countries(undefined, 'fr');
    expect(fr.length).toBeGreaterThan(190);
    expect(fr.find((c) => c.value === 'FR')?.label).toBe('France');
    const sorted = [...fr].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    expect(fr.map((c) => c.value)).toEqual(sorted.map((c) => c.value));
  });

  it('filters by name substring (any language) or exact code, case-insensitively', () => {
    expect(ctrl.countries('fran', 'fr', '5').map((c) => c.value)).toContain('FR');
    expect(ctrl.countries('bj', 'en').map((c) => c.value)).toContain('BJ');
  });

  it('caps the result count and falls back to English for an unsupported language', () => {
    expect(ctrl.countries('', 'en', '3')).toHaveLength(3);
    expect(ctrl.countries(undefined, 'de').find((c) => c.value === 'US')?.label).toBe('United States');
  });
});
