import { Injectable } from '@nestjs/common';
import { safeFetch } from '../../common/safe-fetch.util';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';
import { fetchUpcoming, type Fetcher } from '../calendar/calendar.provider';

const CALENDAR_BASE = 'https://my.epitech.eu/api/events/calendar/';
const TOKEN_RE = /^[A-Za-z0-9._~-]{8,200}$/;

// What is (and isn't) available from My Epitech is documented in API.md:
// the OIDC login only yields identity claims, and the student-data API needs
// the SPA's internal token, which we deliberately never ask users to paste.
@Injectable()
export class EpitechProvider implements ServiceProvider {
  name = 'epitech';
  requiresAuth = false;
  fetcher: Fetcher = safeFetch;
  widgets: WidgetDefinition[];

  constructor() {
    this.widgets = [
      {
        name: 'planning',
        description: 'Your My Epitech planning (activities, rooms), from your personal calendar link',
        // The token in "My Epitech > Calendar" is a credential for your planning.
        params: [
          { name: 'calendarToken', type: 'string', required: true, secret: true },
          { name: 'days', type: 'integer' },
          { name: 'number', type: 'integer' },
        ],
        shareable: false,
        fetchData: async (config) => {
          const token = String(config.calendarToken ?? '').trim();
          if (!TOKEN_RE.test(token)) {
            throw new ServiceFetchError('epitech', 'planning', 'The calendar token is missing or malformed');
          }
          return fetchUpcoming(this.fetcher, CALENDAR_BASE + token, config, 'epitech', 'planning');
        },
      },
      {
        name: 'profile',
        description: 'Your Epitech identity (login, campus, promotion) from your linked My Epitech account',
        params: [],
        requiresAuth: true,
        shareable: false,
        fetchData: async (_config, auth) => {
          const p = auth?.profile;
          if (!p) throw new ServiceFetchError('epitech', 'profile', 'Link your My Epitech account first');
          return p;
        },
      },
    ];
  }
}
