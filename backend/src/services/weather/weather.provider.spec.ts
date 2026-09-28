import { clearPlaceCache, conditionOf, WeatherProvider } from './weather.provider';
import { ServiceFetchError } from '../service-provider.interface';

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as unknown as Response;
}
const COTONOU = { results: [{ name: 'Cotonou', country: 'Benin', latitude: 6.36, longitude: 2.41 }] }
// Answers by URL: every geocoding call gets `geo` (one call per language), forecast calls get the next answer
function mockApi(geo: unknown, ...forecasts: unknown[]) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(jsonResponse(String(url).includes('geocoding-api') ? geo : forecasts.length > 1 ? forecasts.shift() : forecasts[0])),
  ) as any;
}
const forecastUrl = () => new URL((global.fetch as jest.Mock).mock.calls.map((c) => String(c[0])).filter((u) => !u.includes('geocoding-api')).at(-1)!)

describe('WeatherProvider', () => {
  const provider = new WeatherProvider();
  const widget = (name: string) => provider.widgets.find((w) => w.name === name)!;

  afterEach(() => jest.restoreAllMocks());
  beforeEach(() => clearPlaceCache());

  it('exposes the contract expected by /about.json, usable without any account', () => {
    expect(provider.name).toBe('weather');
    expect(provider.requiresAuth).toBe(false);
    expect(provider.widgets.map((w) => w.name).sort()).toEqual(['current_weather', 'daily_forecast', 'hourly_forecast']);
    for (const w of provider.widgets) expect(w.params.find((p) => p.name === 'city')?.required).toBe(true);
  });

  it('groups WMO weather codes into a few conditions', () => {
    expect(conditionOf(0)).toBe('clear');
    expect(conditionOf(2)).toBe('partly_cloudy');
    expect(conditionOf(45)).toBe('fog');
    expect(conditionOf(53)).toBe('drizzle');
    expect(conditionOf(63)).toBe('rain');
    expect(conditionOf(81)).toBe('rain');
    expect(conditionOf(73)).toBe('snow');
    expect(conditionOf(95)).toBe('thunderstorm');
  });

  it('current_weather finds the city, then asks for its current weather', async () => {
    mockApi(
      COTONOU,
        ({
          current: { temperature_2m: 28.4, apparent_temperature: 31.6, relative_humidity_2m: 70, wind_speed_10m: 15.2, weather_code: 2, is_day: 1 },
          daily: { temperature_2m_max: [30.7], temperature_2m_min: [24.1] },
        }),
    );

    const result = await widget('current_weather').fetchData({ city: 'Cotonou' });

    expect(result).toEqual({
      city: 'Cotonou', country: 'Benin', unit: 'celsius', temperature: 28, feelsLike: 32, humidity: 70, windKmh: 15,
      condition: 'partly_cloudy', isDay: true, high: 31, low: 24,
    });
    expect(forecastUrl().searchParams.get('latitude')).toBe('6.36');
    expect(forecastUrl().searchParams.get('timezone')).toBe('auto');
  });

  it('passes the unit through and rejects an unknown one', async () => {
    mockApi(COTONOU, { current: {}, daily: {} });
    await widget('current_weather').fetchData({ city: 'Cotonou', unit: 'Fahrenheit' });
    expect(forecastUrl().searchParams.get('temperature_unit')).toBe('fahrenheit');
    await expect(widget('current_weather').fetchData({ city: 'Cotonou', unit: 'kelvin' })).rejects.toThrow(/Unknown unit "kelvin"/);
  });

  it('raises a readable error for an unknown city', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({})) as any;
    await expect(widget('current_weather').fetchData({ city: 'Atlantis' })).rejects.toThrow('No city found for "Atlantis"');
  });

  it('refuses an empty city without calling the API', async () => {
    global.fetch = jest.fn() as any;
    await expect(widget('daily_forecast').fetchData({ city: '  ' })).rejects.toBeInstanceOf(ServiceFetchError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('daily_forecast skips today, returns the next N days, and caps N at 16', async () => {
    mockApi(
      COTONOU,
        ({
          current: { temperature_2m: 29, weather_code: 0 },
          daily: {
            time: ['2026-09-25', '2026-09-26', '2026-09-27'],
            weather_code: [0, 61, 3],
            temperature_2m_max: [31, 30.6, 29.2],
            temperature_2m_min: [24, 23.8, 23.1],
            precipitation_probability_max: [5, 80, 20],
          },
        }),
    );

    const result = (await widget('daily_forecast').fetchData({ city: 'Cotonou', days: 2 })) as any;

    expect(result.now).toEqual({ temperature: 29, condition: 'clear' });
    expect(result.days).toEqual([
      { date: '2026-09-26', condition: 'rain', min: 24, max: 31, rainChance: 80 },
      { date: '2026-09-27', condition: 'cloudy', min: 23, max: 29, rainChance: 20 },
    ]);
    expect(forecastUrl().searchParams.get('forecast_days')).toBe('3');

    clearPlaceCache()
    mockApi(COTONOU, { daily: {} });
    await widget('daily_forecast').fetchData({ city: 'Cotonou', days: 99 });
    expect(forecastUrl().searchParams.get('forecast_days')).toBe('17');
  });

  it('hourly_forecast returns one entry per hour, 12 by default', async () => {
    mockApi(COTONOU, { hourly: { time: ['2026-09-25T12:00'], temperature_2m: [29.6], weather_code: [80], precipitation_probability: [60] } });

    const result = (await widget('hourly_forecast').fetchData({ city: 'Cotonou' })) as any;

    expect(result.hours).toEqual([{ time: '2026-09-25T12:00', temperature: 30, condition: 'rain', rainChance: 60 }]);
    expect(forecastUrl().searchParams.get('forecast_hours')).toBe('12');
  });

  it('geocodes a city only once, then reuses its coordinates', async () => {
    mockApi(COTONOU, { current: {}, daily: {} });
    await widget('current_weather').fetchData({ city: 'Cotonou' });
    await widget('current_weather').fetchData({ city: 'cotonou' });
    const geocodeCalls = (global.fetch as jest.Mock).mock.calls.filter((c) => String(c[0]).includes('geocoding-api'));
    expect(geocodeCalls).toHaveLength(3); // fr, en, es for the first call, none for the second
  });

  it('keeps the most populated city among the languages (Londres is London, not the Argentine village)', async () => {
    global.fetch = jest.fn((url: string) => {
      const u = new URL(url);
      if (!u.hostname.startsWith('geocoding')) return Promise.resolve(jsonResponse({ current: {}, daily: {} }));
      const argentina = { name: 'Londres', country: 'Argentina', latitude: -27.7, longitude: -67.1, population: 2627 };
      const london = { name: 'Londres', country: 'Royaume-Uni', latitude: 51.5, longitude: -0.12, population: 8961989 };
      return Promise.resolve(jsonResponse({ results: u.searchParams.get('language') === 'fr' ? [london, argentina] : [argentina] }));
    }) as any;
    const result = (await widget('current_weather').fetchData({ city: 'Londres' })) as any;
    expect(result.country).toBe('Royaume-Uni');
    expect(forecastUrl().searchParams.get('latitude')).toBe('51.5');
  });

  it('exposes the temperature as the primary metric (history and alerts)', () => {
    expect(widget('current_weather').primaryMetric!({ temperature: 28 })).toBe(28);
    expect(widget('daily_forecast').primaryMetric!({ now: { temperature: 29 } })).toBe(29);
    expect(widget('current_weather').primaryMetric!({})).toBeNull();
  });

  it('builds AI advice and what to wear from the widget data, clipped', async () => {
    const completeJson = jest.fn().mockResolvedValue({ advice: 'Averses cet après-midi : sors le matin', outfit: 'Parapluie et tenue légère' });
    const ctx = { userId: 'u', language: 'fr', config: {}, ai: { available: true, completeJson }, cache: { get: jest.fn(), set: jest.fn() } } as any;
    const result = await widget('daily_forecast').enrich!({ city: 'Cotonou', days: [] }, ctx);
    expect(result).toEqual({ kind: 'weather_advice', advice: 'Averses cet après-midi : sors le matin', outfit: 'Parapluie et tenue légère', language: 'fr' });
    expect(completeJson.mock.calls[0][0].user).toContain('Cotonou');
  });

  it('raises ServiceFetchError when the API is down', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({}, 503)) as any;
    await expect(widget('current_weather').fetchData({ city: 'Cotonou' })).rejects.toThrow(/HTTP 503/);
  });
});

describe('searchCities', () => {
  it('returns [] under 2 characters, and results with a readable label otherwise', async () => {
    const { searchCities } = await import('./weather.provider');
    expect(await searchCities('a', 'en')).toEqual([]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ name: 'Paris', admin1: 'Ile-de-France', country: 'France', population: 2000000, latitude: 1, longitude: 1 }] }),
    }) as any;
    const r = await searchCities('par', 'fr', 5);
    expect(r).toEqual([{ value: 'Paris', label: 'Paris, Ile-de-France, France', country: 'France', admin1: 'Ile-de-France' }]);
  });

  it('falls back to "en" for an unsupported language and clamps the limit', async () => {
    const { searchCities } = await import('./weather.provider');
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    global.fetch = fetchMock as any;
    await searchCities('tokyo', 'de', 999);
    const url = new URL((fetchMock.mock.calls[0][0] as string));
    expect(url.searchParams.get('language')).toBe('en');
    expect(url.searchParams.get('count')).toBe('15');
  });
});
