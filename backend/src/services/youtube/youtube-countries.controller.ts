import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as ctz from 'countries-and-timezones';
import { SessionGuard } from '../../auth/session.guard';

export interface CountrySuggestion {
  value: string;
  label: string;
}

// Feeds the "trending" widget's "country" field (see WidgetParam.optionsUrl): every 2-letter country
// code YouTube's regionCode accepts, named in the requested language. Static data, no external call.
let cache: CountrySuggestion[] | null = null;
function allCountries(lang: string): CountrySuggestion[] {
  const display = new Intl.DisplayNames([lang], { type: 'region' });
  return Object.keys(ctz.getAllCountries())
    .map((code) => ({ value: code, label: display.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
}

@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/youtube')
@UseGuards(SessionGuard)
export class YoutubeCountriesController {
  @Get('countries')
  @ApiOperation({ summary: 'Search countries for the "trending" widget — type-ahead, named in the requested language' })
  @ApiResponse({ status: 200, description: '[{ value: "FR", label: "France" }]' })
  countries(@Query('q') q?: string, @Query('lang') lang?: string, @Query('limit') limit?: string) {
    const l = lang === 'fr' || lang === 'es' ? lang : 'en';
    const list = cache && l === 'en' ? cache : allCountries(l);
    if (l === 'en') cache = list;
    const needle = (q ?? '').trim().toLowerCase();
    const filtered = needle ? list.filter((c) => c.label.toLowerCase().includes(needle) || c.value.toLowerCase() === needle) : list;
    return filtered.slice(0, Math.min(Math.max(Number(limit) || 300, 1), 300));
  }
}
