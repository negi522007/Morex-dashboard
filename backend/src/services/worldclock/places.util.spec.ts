import { resolveZone, searchPlaces } from './places.util';

describe('searchPlaces', () => {
  it('finds countries, not only cities (the "Égypte" / "Bangladesh" case)', () => {
    expect(searchPlaces('Égypte', 'fr')[0]).toMatchObject({ value: 'Africa/Cairo', kind: 'country', label: 'Égypte' });
    expect(searchPlaces('bangla', 'en')[0]).toMatchObject({ value: 'Asia/Dhaka', kind: 'country' });
  });

  it('finds cities regardless of accents and language, with a localised label', () => {
    expect(searchPlaces('cotonou', 'fr')[0]).toMatchObject({ value: 'Africa/Porto-Novo', label: 'Cotonou, Bénin' });
    expect(searchPlaces('Londres', 'fr')[0]).toMatchObject({ value: 'Europe/London', label: 'Londres, Royaume-Uni' });
    expect(searchPlaces('nueva y', 'es')[0].value).toBe('America/New_York');
  });

  it('understands common short names and puts multi-zone countries on their main zone', () => {
    expect(searchPlaces('usa', 'en')[0]).toMatchObject({ kind: 'country', value: 'America/New_York' });
    expect(searchPlaces('uk', 'en')[0].value).toBe('Europe/London');
  });

  it('lists the biggest cities when nothing is typed, and respects the limit', () => {
    const r = searchPlaces('', 'en', 5);
    expect(r).toHaveLength(5);
    expect(r.every((p) => p.kind === 'city')).toBe(true);
  });

  it('accepts raw zone names, returns nothing for nonsense, and includes the UTC offset', () => {
    expect(searchPlaces('Africa/Cairo')[0]).toMatchObject({ value: 'Africa/Cairo', kind: 'zone' });
    expect(searchPlaces('qqqxxzzy')).toEqual([]);
    expect(searchPlaces('paris')[0].offset).toMatch(/^UTC[+-]\d/);
  });

  it('is capped at 20 results', () => {
    expect(searchPlaces('a', 'en', 500).length).toBeLessThanOrEqual(20);
  });
});

describe('resolveZone', () => {
  it('keeps a valid zone, resolves names and countries in any language, rejects the rest', () => {
    expect(resolveZone('Europe/Paris')).toBe('Europe/Paris');
    expect(resolveZone('Cotonou')).toBe('Africa/Porto-Novo');
    expect(resolveZone('Égypte')).toBe('Africa/Cairo');
    expect(resolveZone('Bangladesh')).toBe('Asia/Dhaka');
    expect(resolveZone('Londres')).toBe('Europe/London');
    expect(resolveZone('xyzzy')).toBeNull();
  });

  it('does not silently guess from a partial name', () => {
    expect(resolveZone('Par')).toBeNull();
    expect(resolveZone('')).toBeNull();
  });
  it('returns the ISO country code so the client can show a flag', () => {
    const paris = searchPlaces('paris', 'fr').find((p) => p.value === 'Europe/Paris' && p.kind === 'city');
    expect(paris?.iso2).toBe('FR');
  });
});
