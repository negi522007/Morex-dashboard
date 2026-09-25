import { WeatherProvider } from './weather.provider';
import { ServiceFetchError } from '../service-provider.interface';

const geocodeHit = { results: [{ name: 'Cotonou', country: 'Benin', latitude: 6.36, longitude: 2.41 }] };
const forecastBody = {
  current: { temperature_2m: 27.7, weather_code: 3 },
  daily: {
    time: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'],
    weather_code: [0, 1, 2, 61, 3, 0],
    temperature_2m_max: [30, 31.2, 29.6, 27, 28, 32],
    temperature_2m_min: [24, 24.4, 23.5, 22, 23, 25],
  },
};

describe('WeatherProvider', () => {
  const provider = new WeatherProvider();
  const widget = provider.widgets[0];

  it('exposes a no-auth forecast widget', () => {
    expect(provider.name).toBe('weather');
    expect(provider.requiresAuth).toBe(false);
    expect(widget.name).toBe('forecast');
  });

  it('rejects a missing city', async () => {
    await expect(widget.fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('rejects a city the geocoder does not know', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as any;
    await expect(widget.fetchData({ city: 'Nowhereville-xyz' })).rejects.toThrow(/not found/);
  });

  it('returns today plus the next five days, rounded', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(geocodeHit) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(forecastBody) }) as any;
    const result = (await widget.fetchData({ city: 'Cotonou' })) as any;
    expect(result.city).toBe('Cotonou');
    expect(result.temperature).toBe(28);
    expect(result.days).toHaveLength(5);
    expect(result.days[0]).toEqual({ date: 'd1', weatherCode: 1, min: 24, max: 31 });
  });

  it('does not geocode the same city twice', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(forecastBody) }) as any;
    await widget.fetchData({ city: 'Cotonou' });
    const calls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('geocoding-api'))).toBe(false);
  });

  it('raises ServiceFetchError on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
    await expect(widget.fetchData({ city: 'Uncached City' })).rejects.toBeInstanceOf(ServiceFetchError);
  });
});
