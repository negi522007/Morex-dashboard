import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { PlaceLang, searchPlaces } from './places.util';

// Feeds the world clock's dropdowns (see WidgetParam.optionsUrl): cities, countries and time zones.
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/worldclock')
@UseGuards(SessionGuard)
export class WorldclockController {
  @Get('places')
  @ApiOperation({ summary: 'Search cities, countries and time zones — options for the world clock form (type-ahead)' })
  @ApiResponse({ status: 200, description: '[{ value: IANA zone, label, kind: "city"|"country"|"zone", country, offset }]. Empty q = the biggest cities.' })
  places(@Query('q') q?: string, @Query('lang') lang?: string, @Query('limit') limit?: string) {
    const l: PlaceLang = lang === 'fr' || lang === 'es' ? lang : 'en';
    return searchPlaces((q ?? '').slice(0, 60), l, Number(limit) || 8);
  }
}
