import { WorldclockProvider } from './worldclock.provider';
import { ServiceFetchError } from '../service-provider.interface';

describe('WorldclockProvider', () => {
  const provider = new WorldclockProvider();
  const widget = provider.widgets[0];

  it('exposes requiresAuth: false (pure computation, no external API)', () => {
    expect(provider.requiresAuth).toBe(false);
    expect(provider.name).toBe('worldclock');
  });

  it('rejects when homeTimezone or cities is missing', async () => {
    await expect(widget.fetchData({ cities: 'Europe/Paris' })).rejects.toBeInstanceOf(ServiceFetchError);
    await expect(widget.fetchData({ homeTimezone: 'Europe/Paris' })).rejects.toBeInstanceOf(ServiceFetchError);
  });

  it('rejects an unknown timezone', async () => {
    await expect(widget.fetchData({ homeTimezone: 'Not/AZone', cities: 'Europe/Paris' })).rejects.toBeInstanceOf(
      ServiceFetchError,
    );
  });

  it('computes home and each city, with a human label and a same-day offset of 0', async () => {
    const result: any = await widget.fetchData({ homeTimezone: 'Europe/Paris', cities: 'Europe/Paris,America/New_York' });
    expect(result.home.timezone).toBe('Europe/Paris');
    expect(result.cities).toHaveLength(2);
    const paris = result.cities.find((c: any) => c.timezone === 'Europe/Paris');
    expect(paris.label).toBe('Paris');
    expect(paris.hoursDiff).toBe(0);
    expect(typeof result.home.isDay).toBe('boolean');
  });

  it('handles a multi-word city label (underscores become spaces)', async () => {
    const result: any = await widget.fetchData({ homeTimezone: 'Europe/Paris', cities: 'America/New_York' });
    expect(result.cities[0].label).toBe('New York');
  });

  it('accepts city and country names (any language) and keeps what the user typed as the label', async () => {
    const result: any = await widget.fetchData({ homeTimezone: 'Cotonou', cities: 'Delhi, Égypte, Bangladesh' });
    expect(result.home.timezone).toBe('Africa/Porto-Novo');
    expect(result.cities.map((c: any) => [c.label, c.timezone])).toEqual([
      ['Delhi', 'Asia/Kolkata'],
      ['Égypte', 'Africa/Cairo'],
      ['Bangladesh', 'Asia/Dhaka'],
    ]);
  });

  it('names the unknown place in the error instead of a generic failure', async () => {
    await expect(widget.fetchData({ homeTimezone: 'Paris', cities: 'Atlantide' })).rejects.toThrow(/Unknown place "Atlantide"/);
  });

  it('advertises the type-ahead dropdown and the multi-value cities param to the frontend', () => {
    const cities = widget.params.find((p) => p.name === 'cities');
    expect(cities).toMatchObject({ optionsUrl: '/services/worldclock/places', multiple: true });
    expect(widget.params.find((p) => p.name === 'homeTimezone')?.optionsUrl).toBe('/services/worldclock/places');
  });
  it('gives each city its country code for a flag, and keeps a typed name as the label', async () => {
    const d: any = await provider.widgets[0].fetchData({ homeTimezone: 'Cotonou', cities: 'Paris, Asia/Tokyo' });
    expect(d.home).toMatchObject({ timezone: 'Africa/Porto-Novo', label: 'Cotonou', iso2: 'BJ' });
    expect(d.cities.map((c: any) => [c.label, c.iso2])).toEqual([['Paris', 'FR'], ['Tokyo', 'JP']]);
  });
});
