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
});
