import { Injectable } from '@nestjs/common';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

interface ZonedNow {
  hour: number;
  minute: number;
  dateKey: string;
  epochMinutes: number;
}

// No external API — this is pure Intl.DateTimeFormat arithmetic against
// IANA timezone names, so it never fails on the network and never needs a
// requiresAuth account. The only way it fails is a caller passing a
// timezone Intl doesn't recognise.
function zonedNow(now: Date, timeZone: string, widgetName: string): ZonedNow {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
  } catch {
    throw new ServiceFetchError('worldclock', widgetName, `Unknown timezone "${timeZone}"`);
  }
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    hour,
    minute,
    dateKey: `${parts.year}${parts.month}${parts.day}`,
    epochMinutes: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, minute) / 60_000,
  };
}

// Human label from an IANA zone id, e.g. "America/New_York" -> "New York".
function labelFor(timeZone: string): string {
  const last = timeZone.split('/').pop() ?? timeZone;
  return last.replace(/_/g, ' ');
}

const worldClock: WidgetDefinition = {
  name: 'world_clock',
  description: "Show the current time in a set of cities relative to the user's own timezone",
  params: [
    { name: 'homeTimezone', type: 'string', required: true },
    { name: 'cities', type: 'string', required: true },
  ],
  async fetchData(config) {
    const homeTimezone = String(config.homeTimezone ?? '');
    const citiesRaw = String(config.cities ?? '');
    if (!homeTimezone || !citiesRaw) {
      throw new ServiceFetchError('worldclock', 'world_clock', 'Both "homeTimezone" and "cities" parameters are required');
    }
    const cityZones = citiesRaw
      .split(',')
      .map((tz) => tz.trim())
      .filter(Boolean);
    if (cityZones.length === 0) {
      throw new ServiceFetchError('worldclock', 'world_clock', '"cities" must contain at least one IANA timezone');
    }

    const now = new Date();
    const home = zonedNow(now, homeTimezone, 'world_clock');

    const cities = cityZones.map((timeZone) => {
      const z = zonedNow(now, timeZone, 'world_clock');
      const hoursDiff = Math.round(((z.epochMinutes - home.epochMinutes) / 60) * 2) / 2;
      const dayOffset = z.dateKey === home.dateKey ? 0 : z.dateKey > home.dateKey ? 1 : -1;
      return {
        timezone: timeZone,
        label: labelFor(timeZone),
        hour: z.hour,
        minute: z.minute,
        isDay: z.hour >= 6 && z.hour < 18,
        hoursDiff,
        dayOffset,
      };
    });

    return {
      home: { timezone: homeTimezone, hour: home.hour, minute: home.minute, isDay: home.hour >= 6 && home.hour < 18 },
      cities,
    };
  },
};

@Injectable()
export class WorldclockProvider implements ServiceProvider {
  name = 'worldclock';
  requiresAuth = false;
  widgets: WidgetDefinition[] = [worldClock];
}
