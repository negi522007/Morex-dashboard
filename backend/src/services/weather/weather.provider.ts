import { Injectable } from '@nestjs/common';
import { UNTRUSTED_RULES, clip, languageName } from '../../ai/ai.service';
import { EnrichContext, ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

// Open-Meteo: free, no API key, no account — so this service works for every
// user without subscribing to anything (the brief asks for at least one such service).
const FETCH_TIMEOUT_MS = 10_000;
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather codes (what Open-Meteo returns) grouped into a few conditions.
// The frontend turns each condition into an icon and a translated label.
export function conditionOf(code: number): string {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}

async function fetchJson(url: string, widgetName: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    throw new ServiceFetchError('weather', widgetName, `Could not reach the weather API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new ServiceFetchError('weather', widgetName, `Weather API returned HTTP ${res.status}`);
  return res.json();
}

interface Place {
  city: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

const GEOCODING_LANGUAGES = ['fr', 'en', 'es'];

// A city never moves, so each name is geocoded once per process.
const placeCache = new Map<string, Place>();
export const clearPlaceCache = () => placeCache.clear();

// City name → coordinates. The forecast API only understands coordinates.
async function findCity(config: Record<string, string | number>, widgetName: string): Promise<Place> {
  const name = String(config.city ?? '').trim();
  if (!name) throw new ServiceFetchError('weather', widgetName, 'Missing required "city" parameter');
  const cached = placeCache.get(name.toLowerCase());
  if (cached) return cached;
  // Search the name in the three app languages and keep the most populated match: the first English
  // result for "Londres" is a village in Argentina, while the French search finds London.
  const lists = await Promise.all(
    GEOCODING_LANGUAGES.map((language) =>
      fetchJson(`${GEOCODING_URL}?${new URLSearchParams({ name, count: '10', language })}`, widgetName).then((d) => d?.results ?? []),
    ),
  );
  const place = lists.flat().reduce((best: any, p: any) => (!best || (p.population ?? 0) > (best.population ?? 0) ? p : best), null);
  if (!place) throw new ServiceFetchError('weather', widgetName, `No city found for "${name}"`);
  const found = { city: place.name, country: place.country ?? null, latitude: place.latitude, longitude: place.longitude };
  placeCache.set(name.toLowerCase(), found);
  return found;
}

function parseUnit(config: Record<string, string | number>, widgetName: string): 'celsius' | 'fahrenheit' {
  const unit = String(config.unit ?? 'celsius').toLowerCase();
  if (unit !== 'celsius' && unit !== 'fahrenheit') {
    throw new ServiceFetchError('weather', widgetName, `Unknown unit "${unit}" (use celsius or fahrenheit)`);
  }
  return unit;
}

function clampInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

const forecast = (place: Place, unit: string, extra: Record<string, string>, widgetName: string) =>
  fetchJson(
    `${FORECAST_URL}?${new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      temperature_unit: unit,
      timezone: 'auto', // times come back in the city's local time
      ...extra,
    })}`,
    widgetName,
  );

const round = (n: unknown) => (typeof n === 'number' ? Math.round(n) : null);

// One practical piece of advice + what to wear, from the data the widget already has.
// Weather is public data: nothing personal is sent to the model.
async function weatherAdvice(data: unknown, ctx: EnrichContext) {
  const out = await ctx.ai.completeJson<{ advice?: string; outfit?: string }>({
    system:
      `You give one practical piece of weather advice in ${languageName(ctx.language)}. ${UNTRUSTED_RULES} ` +
      'Schema: {"advice": string (max 160 chars: what to expect and plan for), "outfit": string (max 80 chars: what to wear/bring)}. ' +
      'Conditions are one of: clear, partly_cloudy, cloudy, fog, drizzle, rain, snow, thunderstorm. Use only the data given.',
    user: `<data>${JSON.stringify(data)}</data>`,
    maxTokens: 250,
    mock: { advice: `${(data as { city?: string })?.city ?? ''}`, outfit: '' },
  });
  return { kind: 'weather_advice', advice: clip(out.advice ?? '', 170), outfit: clip(out.outfit ?? '', 90), language: ctx.language };
}

const currentWeather: WidgetDefinition = {
  name: 'current_weather',
  description: 'Display the current temperature, sky, humidity and wind for a city',
  params: [
    { name: 'city', type: 'string', required: true },
    { name: 'unit', type: 'string' },
  ],
  // The temperature drives the value history and alerts ("tell me when it goes above 30°")
  primaryMetric: (d) => ((d as { temperature?: unknown })?.temperature as number) ?? null,
  enrich: weatherAdvice,
  async fetchData(config) {
    const unit = parseUnit(config, 'current_weather');
    const place = await findCity(config, 'current_weather');
    const data = await forecast(
      place,
      unit,
      {
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
        daily: 'temperature_2m_max,temperature_2m_min',
        forecast_days: '1',
      },
      'current_weather',
    );
    const c = data?.current ?? {};
    return {
      city: place.city,
      country: place.country,
      unit,
      temperature: round(c.temperature_2m),
      feelsLike: round(c.apparent_temperature),
      humidity: c.relative_humidity_2m ?? null,
      windKmh: round(c.wind_speed_10m),
      condition: conditionOf(c.weather_code),
      isDay: c.is_day === 1,
      high: round(data?.daily?.temperature_2m_max?.[0]),
      low: round(data?.daily?.temperature_2m_min?.[0]),
    };
  },
};

const dailyForecast: WidgetDefinition = {
  name: 'daily_forecast',
  description: 'Display the forecast for the next days in a city (1 to 16 days)',
  params: [
    { name: 'city', type: 'string', required: true },
    { name: 'days', type: 'integer' },
    { name: 'unit', type: 'string' },
  ],
  primaryMetric: (d) => ((d as { now?: { temperature?: unknown } })?.now?.temperature as number) ?? null,
  enrich: weatherAdvice,
  async fetchData(config) {
    const unit = parseUnit(config, 'daily_forecast');
    const days = clampInt(config.days, 5, 16);
    const place = await findCity(config, 'daily_forecast');
    const data = await forecast(
      place,
      unit,
      {
        current: 'temperature_2m,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
        // +1 because today is the first day returned, and the list shows the days after it
        forecast_days: String(days + 1),
      },
      'daily_forecast',
    );
    const d = data?.daily ?? {};
    return {
      city: place.city,
      country: place.country,
      unit,
      now: { temperature: round(data?.current?.temperature_2m), condition: conditionOf(data?.current?.weather_code) },
      days: (d.time ?? []).slice(1, days + 1).map((date: string, i: number) => ({
        date,
        condition: conditionOf(d.weather_code?.[i + 1]),
        min: round(d.temperature_2m_min?.[i + 1]),
        max: round(d.temperature_2m_max?.[i + 1]),
        rainChance: d.precipitation_probability_max?.[i + 1] ?? null,
      })),
    };
  },
};

const hourlyForecast: WidgetDefinition = {
  name: 'hourly_forecast',
  description: 'Display the temperature and chance of rain for the next hours in a city (1 to 48 hours)',
  params: [
    { name: 'city', type: 'string', required: true },
    { name: 'hours', type: 'integer' },
    { name: 'unit', type: 'string' },
  ],
  async fetchData(config) {
    const unit = parseUnit(config, 'hourly_forecast');
    const hours = clampInt(config.hours, 12, 48);
    const place = await findCity(config, 'hourly_forecast');
    const data = await forecast(
      place,
      unit,
      { hourly: 'temperature_2m,weather_code,precipitation_probability', forecast_hours: String(hours) },
      'hourly_forecast',
    );
    const h = data?.hourly ?? {};
    return {
      city: place.city,
      country: place.country,
      unit,
      hours: (h.time ?? []).map((time: string, i: number) => ({
        time,
        temperature: round(h.temperature_2m?.[i]),
        condition: conditionOf(h.weather_code?.[i]),
        rainChance: h.precipitation_probability?.[i] ?? null,
      })),
    };
  },
};

@Injectable()
export class WeatherProvider implements ServiceProvider {
  name = 'weather';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [currentWeather, dailyForecast, hourlyForecast];
}
