import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { AssetKind, searchAssets } from './assets.util';

// Feeds the market widgets' currency/asset fields (see WidgetParam.optionsUrl).
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/market_data')
@UseGuards(SessionGuard)
export class MarketAssetsController {
  @Get('assets')
  @ApiOperation({ summary: 'Search currencies and/or crypto assets — type-ahead. kind=fiat|crypto|all (set by the widget\'s optionsUrl)' })
  @ApiResponse({ status: 200, description: '[{ value, label, kind: "fiat"|"crypto" }]' })
  assets(@Query('q') q?: string, @Query('kind') kind?: string, @Query('limit') limit?: string) {
    const k: AssetKind = kind === 'fiat' || kind === 'crypto' ? kind : 'all';
    return searchAssets((q ?? '').slice(0, 60), k, Number(limit) || 10);
  }
}
