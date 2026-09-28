import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { searchCities } from './weather.provider';

// Feeds the weather widgets' "city" field (see WidgetParam.optionsUrl) with live geocoder results.
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/weather')
@UseGuards(SessionGuard)
export class WeatherCitiesController {
  @Get('cities')
  @ApiOperation({ summary: 'Search cities for the weather widgets — type-ahead, live (Open-Meteo geocoder)' })
  @ApiResponse({ status: 200, description: '[{ value, label, country, admin1 }], fewer than 2 characters in "q" returns []' })
  cities(@Query('q') q?: string, @Query('lang') lang?: string, @Query('limit') limit?: string) {
    return searchCities((q ?? '').slice(0, 80), lang ?? 'en', Number(limit) || 8);
  }
}
