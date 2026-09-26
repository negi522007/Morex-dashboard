import * as cityTz from 'city-timezones';
import * as countriesTz from 'countries-and-timezones';

// Search over cities, countries and raw IANA zones, so people can type "Cotonou", "Égypte" or
// "Bangladesh" instead of "Africa/Porto-Novo". The widget itself always stores IANA zone names.

export type PlaceLang = 'en' | 'fr' | 'es';

export interface Place {
  value: string; // IANA zone, e.g. "Africa/Cairo"
  label: string; // "Le Caire, Égypte"
  kind: 'city' | 'country' | 'zone';
  country: string | null;
  offset: string; // "UTC+2"
}

interface Entry {
  zone: string;
  kind: Place['kind'];
  names: string[]; // folded, searchable
  primary: string; // display name (English for cities)
  iso2: string | null;
  pop: number;
}

export const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`.]/g, '').replace(/[\s_-]+/g, ' ').trim();

// French / Spanish names of big cities → the English name used by the dataset.
const EXONYMS: Record<string, string> = {
  londres: 'London', moscou: 'Moscow', moscu: 'Moscow', 'le caire': 'Cairo', 'el cairo': 'Cairo', pekin: 'Beijing', 'pekin ': 'Beijing',
  athenes: 'Athens', atenas: 'Athens', bruxelles: 'Brussels', bruselas: 'Brussels', lisbonne: 'Lisbon', lisboa: 'Lisbon',
  geneve: 'Geneva', ginebra: 'Geneva', varsovie: 'Warsaw', varsovia: 'Warsaw', vienne: 'Vienna', viena: 'Vienna',
  copenhague: 'Copenhagen', 'new york': 'New York', 'nueva york': 'New York', 'la nouvelle orleans': 'New Orleans', 'nueva orleans': 'New Orleans',
  'mexico': 'Mexico City', 'ciudad de mexico': 'Mexico City', 'rio': 'Rio de Janeiro', bombay: 'Mumbai', 'le cap': 'Cape Town', 'ciudad del cabo': 'Cape Town',
  alger: 'Algiers', argel: 'Algiers', 'saint petersbourg': 'Saint Petersburg', 'san petersburgo': 'Saint Petersburg', 'tokio': 'Tokyo',
  'porto novo': 'Porto-Novo', yaounde: 'Yaounde', 'abu dhabi': 'Abu Dhabi', 'la havane': 'Havana', 'la habana': 'Havana', 'seville': 'Seville', 'sevilla': 'Seville',
  cologne: 'Cologne', colonia: 'Cologne', 'munich': 'Munich', 'munchen': 'Munich', florence: 'Florence', firenze: 'Florence', 'venise': 'Venice', venecia: 'Venice',
};

// Short or informal country names people type.
const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'US', 'u s a': 'US', us: 'US', america: 'US', 'etats unis': 'US', 'estados unidos': 'US', uk: 'GB', 'royaume uni': 'GB', angleterre: 'GB', england: 'GB',
  'reino unido': 'GB', uae: 'AE', emirats: 'AE', emiratos: 'AE', 'ivory coast': 'CI', 'cote divoire': 'CI', 'costa de marfil': 'CI', 'south korea': 'KR', 'coree du sud': 'KR',
  'corea del sur': 'KR', russie: 'RU', rusia: 'RU', chine: 'CN', 'allemagne': 'DE', alemania: 'DE', espagne: 'ES', 'espana': 'ES', 'pays bas': 'NL', 'paises bajos': 'NL', holland: 'NL',
  'republique tcheque': 'CZ', 'republica checa': 'CZ', 'rd congo': 'CD', 'drc': 'CD',
};

let index: Entry[] | null = null;

function offsetOf(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return (part?.value ?? '').replace('GMT', 'UTC') || 'UTC';
  } catch {
    return '';
  }
}

function build(): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  const display: Record<PlaceLang, Intl.DisplayNames> = {
    en: new Intl.DisplayNames(['en'], { type: 'region' }),
    fr: new Intl.DisplayNames(['fr'], { type: 'region' }),
    es: new Intl.DisplayNames(['es'], { type: 'region' }),
  };
  const biggestZone = new Map<string, { zone: string; pop: number }>();

  for (const c of cityTz.cityMapping) {
    const key = `${fold(c.city_ascii)}|${c.iso2}`;
    if (!c.timezone) continue;
    const best = biggestZone.get(c.iso2);
    if (!best || c.pop > best.pop) biggestZone.set(c.iso2, { zone: c.timezone, pop: c.pop });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ zone: c.timezone, kind: 'city', names: [...new Set([fold(c.city_ascii), fold(c.city)])], primary: c.city_ascii, iso2: c.iso2, pop: c.pop });
  }

  for (const [iso2, country] of Object.entries(countriesTz.getAllCountries())) {
    const zone = biggestZone.get(iso2)?.zone ?? country.timezones[0];
    if (!zone) continue;
    const names = (['en', 'fr', 'es'] as PlaceLang[]).map((l) => display[l].of(iso2) ?? '').filter(Boolean);
    const aliases = Object.entries(COUNTRY_ALIASES).filter(([, code]) => code === iso2).map(([a]) => a);
    out.push({ zone, kind: 'country', names: [...new Set([...names, country.name, ...aliases].map(fold))], primary: country.name, iso2, pop: Number.MAX_SAFE_INTEGER });
  }

  for (const zone of (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone')) {
    const last = zone.split('/').pop()!.replace(/_/g, ' ');
    out.push({ zone, kind: 'zone', names: [fold(zone), fold(last)], primary: zone, iso2: null, pop: 0 });
  }
  return out;
}

const entries = () => (index ??= build());

function countryName(iso2: string | null, lang: PlaceLang): string | null {
  if (!iso2) return null;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(iso2) ?? null;
  } catch {
    return null;
  }
}

// Localised city name when we know one (exonym table, reversed), else the dataset's name.
function cityLabel(primary: string, lang: PlaceLang): string {
  if (lang === 'en') return primary;
  const want = fold(primary);
  for (const [alias, en] of Object.entries(EXONYMS)) {
    if (fold(en) === want && (lang === 'fr' ? /[a-z]/.test(alias) : true)) {
      // Prefer the alias that belongs to the requested language (fr aliases first in the table).
      if (lang === 'fr' && ['londres', 'moscou', 'le caire', 'pekin', 'athenes', 'bruxelles', 'lisbonne', 'geneve', 'varsovie', 'vienne', 'copenhague', 'bombay', 'le cap', 'alger', 'la havane', 'cologne', 'venise'].includes(alias)) return title(alias);
      if (lang === 'es' && ['moscu', 'el cairo', 'atenas', 'bruselas', 'lisboa', 'ginebra', 'varsovia', 'viena', 'nueva york', 'ciudad de mexico', 'ciudad del cabo', 'argel', 'san petersburgo', 'la habana', 'sevilla', 'colonia', 'venecia', 'tokio'].includes(alias)) return title(alias);
    }
  }
  return primary;
}

const title = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Score: lower is better; null = no match.
function score(e: Entry, q: string, extra: string[]): number | null {
  let best: number | null = null;
  for (const n of e.names) {
    for (const needle of [q, ...extra]) {
      let s: number | null = null;
      if (n === needle) s = 0;
      else if (n.startsWith(needle)) s = 1;
      else if (n.split(' ').some((w) => w.startsWith(needle))) s = 2;
      else if (needle.length >= 3 && n.includes(needle)) s = 3;
      if (s !== null && (best === null || s < best)) best = s;
    }
  }
  return best;
}

const KIND_ORDER = { country: 0, city: 1, zone: 2 } as const;

export function searchPlaces(query: string, lang: PlaceLang = 'en', limit = 8): Place[] {
  const q = fold(query ?? '');
  const max = Math.min(Math.max(Math.floor(limit) || 8, 1), 20);
  let ranked: { e: Entry; s: number }[];

  if (!q) {
    // Nothing typed yet: the biggest cities, as a starting list.
    ranked = entries().filter((e) => e.kind === 'city').sort((a, b) => b.pop - a.pop).slice(0, max).map((e) => ({ e, s: 0 }));
  } else {
    // "londres" / "nueva y" → the English name the dataset uses (prefix-aware).
    const extra = q.length >= 3 ? Object.entries(EXONYMS).filter(([k]) => k.startsWith(q)).map(([, v]) => fold(v)) : [];
    ranked = [];
    for (const e of entries()) {
      const s = score(e, q, extra);
      if (s !== null) ranked.push({ e, s });
    }
    ranked.sort((a, b) => a.s - b.s || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || b.e.pop - a.e.pop || a.e.primary.localeCompare(b.e.primary));
  }

  const out: Place[] = [];
  const seenZone = new Set<string>();
  for (const { e } of ranked) {
    // One row per (zone, kind): a raw zone row would only repeat a city already listed.
    const key = `${e.zone}|${e.kind === 'zone' ? 'z' : e.primary}`;
    if (seenZone.has(key)) continue;
    seenZone.add(key);
    const country = countryName(e.iso2, lang);
    let label: string;
    if (e.kind === 'country') {
      const multi = (countriesTz.getCountry(e.iso2 as string)?.timezones.length ?? 1) > 1;
      const cityName = e.zone.split('/').pop()!.replace(/_/g, ' ');
      label = `${country ?? e.primary}${multi ? ` (${cityName})` : ''}`;
    } else if (e.kind === 'city') {
      label = `${cityLabel(e.primary, lang)}${country ? `, ${country}` : ''}`;
    } else {
      label = e.primary;
    }
    out.push({ value: e.zone, label, kind: e.kind, country, offset: offsetOf(e.zone) });
    if (out.length >= max) break;
  }
  return out;
}

const isZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz.includes('/') || tz === 'UTC';
  } catch {
    return false;
  }
};

// What a user typed → an IANA zone, or null. An exact zone is kept; otherwise the best match must
// be an exact name match (so "Par" does not silently become Paris).
export function resolveZone(input: string): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;
  if (isZone(raw)) return raw;
  const q = fold(raw);
  const target = EXONYMS[q] ? fold(EXONYMS[q]) : q;
  const hits = entries().filter((e) => e.kind !== 'zone' && e.names.includes(target));
  if (hits.length === 0) {
    const z = entries().find((e) => e.kind === 'zone' && e.names.includes(target));
    return z ? z.zone : null;
  }
  hits.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.pop - a.pop);
  return hits[0].zone;
}
