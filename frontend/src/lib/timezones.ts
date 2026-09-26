// The world clock widget needs IANA time zones ("Europe/Paris"), but people type cities ("Paris").
// This turns what was typed into zones before the config is sent to the backend.

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s_-]+/g, ' ').trim()

// Cities people often type that are not the last part of a zone name
const ALIASES: Record<string, string> = {
  cotonou: 'Africa/Porto-Novo', benin: 'Africa/Porto-Novo', 'porto novo': 'Africa/Porto-Novo',
  montreal: 'America/Toronto', quebec: 'America/Toronto', ottawa: 'America/Toronto',
  londres: 'Europe/London', london: 'Europe/London', lisbonne: 'Europe/Lisbon', bruxelles: 'Europe/Brussels',
  geneve: 'Europe/Zurich', geneva: 'Europe/Zurich', munich: 'Europe/Berlin', barcelone: 'Europe/Madrid', barcelona: 'Europe/Madrid',
  milan: 'Europe/Rome', florence: 'Europe/Rome', moscou: 'Europe/Moscow', athenes: 'Europe/Athens', varsovie: 'Europe/Warsaw',
  'new york': 'America/New_York', nyc: 'America/New_York', washington: 'America/New_York', boston: 'America/New_York', miami: 'America/New_York',
  'san francisco': 'America/Los_Angeles', 'los angeles': 'America/Los_Angeles', seattle: 'America/Los_Angeles', 'las vegas': 'America/Los_Angeles',
  houston: 'America/Chicago', dallas: 'America/Chicago', 'mexico': 'America/Mexico_City', rio: 'America/Sao_Paulo', 'rio de janeiro': 'America/Sao_Paulo',
  pekin: 'Asia/Shanghai', beijing: 'Asia/Shanghai', 'hong kong': 'Asia/Hong_Kong', bombay: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata', kyoto: 'Asia/Tokyo', osaka: 'Asia/Tokyo', seoul: 'Asia/Seoul', dubai: 'Asia/Dubai', 'abu dhabi': 'Asia/Dubai',
  abidjan: 'Africa/Abidjan', dakar: 'Africa/Dakar', lome: 'Africa/Lome', accra: 'Africa/Accra', lagos: 'Africa/Lagos', douala: 'Africa/Douala',
  yaounde: 'Africa/Douala', kinshasa: 'Africa/Kinshasa', 'le cap': 'Africa/Johannesburg', 'cape town': 'Africa/Johannesburg', alger: 'Africa/Algiers',
  tunis: 'Africa/Tunis', rabat: 'Africa/Casablanca', marrakech: 'Africa/Casablanca', 'le caire': 'Africa/Cairo', cairo: 'Africa/Cairo',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Melbourne', honolulu: 'Pacific/Honolulu', hawaii: 'Pacific/Honolulu', anchorage: 'America/Anchorage',
}

const isZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz.includes('/') || tz === 'UTC'
  } catch {
    return false
  }
}

let byCity: Map<string, string> | null = null
function cityIndex() {
  if (!byCity) {
    byCity = new Map()
    for (const tz of Intl.supportedValuesOf('timeZone')) byCity.set(fold(tz.split('/').pop()!), tz)
  }
  return byCity
}

// "Paris" → "Europe/Paris"; an exact zone is kept; null when nothing matches
export function toTimeZone(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (isZone(raw)) return raw
  const key = fold(raw)
  return ALIASES[key] ?? cityIndex().get(key) ?? null
}

// Whole comma-separated list; `unknown` lists what could not be matched
export function toTimeZones(input: string): { zones: string[]; unknown: string[] } {
  const zones: string[] = [], unknown: string[] = []
  for (const part of input.split(',').map((p) => p.trim()).filter(Boolean)) {
    const tz = toTimeZone(part)
    if (tz) zones.push(tz)
    else unknown.push(part)
  }
  return { zones, unknown }
}
