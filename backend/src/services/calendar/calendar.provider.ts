import { Injectable } from '@nestjs/common';
import { safeFetch, type SafeResponse } from '../../common/safe-fetch.util';
import { parseIcs, type IcsEvent } from '../../common/ics.util';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

export type Fetcher = (url: string, opts?: { timeoutMs?: number; maxBytes?: number }) => Promise<SafeResponse>;

export interface UpcomingEvents {
  events: IcsEvent[];
  generatedAt: string;
}

function intParam(v: unknown, def: number, max: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
}

// Shared by the generic calendar widget and the My Epitech planning widget.
export async function fetchUpcoming(
  fetcher: Fetcher,
  url: string,
  config: Record<string, string | number>,
  service: string,
  widget: string,
): Promise<UpcomingEvents> {
  let res: SafeResponse;
  try {
    res = await fetcher(url, { timeoutMs: 10_000, maxBytes: 5_000_000 });
  } catch (err) {
    // The URL itself is a credential: never echo it back in an error.
    throw new ServiceFetchError(service, widget, `Could not reach the calendar: ${(err as Error).message.split(url).join('[url]')}`);
  }
  if (!res.ok) throw new ServiceFetchError(service, widget, `The calendar returned HTTP ${res.status}`);
  if (!res.text.includes('BEGIN:VCALENDAR')) throw new ServiceFetchError(service, widget, 'The address did not return an iCalendar (.ics) feed');

  const now = new Date();
  const days = intParam(config.days, 14, 60);
  const events = parseIcs(res.text, {
    from: now,
    to: new Date(now.getTime() + days * 86_400_000),
    limit: intParam(config.number, 8, 30),
  });
  return { events, generatedAt: now.toISOString() };
}

@Injectable()
export class CalendarProvider implements ServiceProvider {
  name = 'calendar';
  requiresAuth = false;
  fetcher: Fetcher = safeFetch;
  widgets: WidgetDefinition[];

  constructor() {
    this.widgets = [
      {
        name: 'upcoming_events',
        description: 'Upcoming events from any iCalendar (.ics) feed — e.g. a Google Calendar secret iCal address',
        // The feed address is a credential (anyone with it can read the calendar).
        params: [
          { name: 'url', type: 'string', required: true, secret: true },
          { name: 'days', type: 'integer' },
          { name: 'number', type: 'integer' },
        ],
        // Private data: never on a public share link.
        shareable: false,
        fetchData: async (config) => {
          const raw = String(config.url ?? '').trim();
          if (!raw) throw new ServiceFetchError('calendar', 'upcoming_events', 'Missing required "url" parameter');
          const url = raw.replace(/^webcals?:\/\//i, 'https://');
          return fetchUpcoming(this.fetcher, url, config, 'calendar', 'upcoming_events');
        },
      },
    ];
  }
}
