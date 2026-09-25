import { Injectable } from '@nestjs/common';
import { UNTRUSTED_RULES, clip, languageName } from '../../ai/ai.service';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

const FETCH_TIMEOUT_MS = 10_000;
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface Place {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

// A city never moves, so geocode each name once per process.
const placeCache = new Map<string, Place>();

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    throw new ServiceFetchError('weather', 'forecast', `Could not reach the weather API: ${(err as Error).message}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new ServiceFetchError('weather', 'forecast', `Weather API returned HTTP ${res.status}`);
  }
  return res.json();
}

async function geocode(city: string): Promise<Place> {
  const key = city.trim().toLowerCase();
  const cached = placeCache.get(key);
  if (cached) return cached;

  const data = await fetchJson(`${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  const hit = data?.results?.[0];
  if (!hit) {
    throw new ServiceFetchError('weather', 'forecast', `City "${city}" not found`);
  }
  const place: Place = { name: hit.name, country: hit.country ?? null, latitude: hit.latitude, longitude: hit.longitude };
  placeCache.set(key, place);
  return place;
}

const forecast: WidgetDefinition = {
  name: 'forecast',
  description: 'Current temperature and the next five days for a city',
  params: [{ name: 'city', type: 'string', required: true }],
  primaryMetric: (d) => ((d as { temperature?: unknown })?.temperature as number) ?? null,
  enrich: async (data, ctx) => {
    const d = data as { city: string; temperature: number; weatherCode: number; days: { date: string; min: number; max: number; weatherCode: number }[] };
    const out = await ctx.ai.completeJson<{ advice?: string; outfit?: string }>({
      system:
        `You give one practical piece of weather advice in ${languageName(ctx.language)}. ${UNTRUSTED_RULES} ` +
        'Schema: {"advice": string (max 160 chars: what to expect and plan for), "outfit": string (max 80 chars: what to wear/bring)}. ' +
        'WMO weather codes: 0 clear, 1-3 cloudy, 45-48 fog, 51-67 drizzle/rain, 71-77 snow, 80-82 showers, 95-99 thunderstorm. Use only the data given.',
      user: `<data>${JSON.stringify(d)}</data>`,
      maxTokens: 250,
      mock: { advice: `${d.city}: ${d.temperature}°C now.`, outfit: '' },
    });
    return { kind: 'weather_advice', advice: clip(out.advice ?? '', 170), outfit: clip(out.outfit ?? '', 90), language: ctx.language };
  },
  async fetchData(config) {
    const city = String(config.city ?? '').trim();
    if (!city) {
      throw new ServiceFetchError('weather', 'forecast', 'Missing required "city" parameter');
    }
    const place = await geocode(city);

    const data = await fetchJson(
      `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
        '&current=temperature_2m,weather_code' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=6',
    );
    const daily = data?.daily;
    if (!data?.current || !Array.isArray(daily?.time)) {
      throw new ServiceFetchError('weather', 'forecast', 'Unexpected response from the weather API');
    }

    // Index 0 is today; the widget lists the following five days.
    const days = (daily.time as string[]).slice(1, 6).map((date, i) => ({
      date,
      weatherCode: daily.weather_code[i + 1],
      min: Math.round(daily.temperature_2m_min[i + 1]),
      max: Math.round(daily.temperature_2m_max[i + 1]),
    }));

    return {
      city: place.name,
      country: place.country,
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      days,
    };
  },
};

@Injectable()
export class WeatherProvider implements ServiceProvider {
  name = 'weather';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [forecast];
}
