import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { CURATED_FEEDS } from './feeds.data';

// A starting point for the "link" field (see WidgetParam.optionsUrl) — the field stays free text,
// this only speeds up picking a well-known feed instead of hunting for its address.
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/rss')
@UseGuards(SessionGuard)
export class RssFeedsController {
  @Get('feeds')
  @ApiOperation({ summary: 'A curated list of well-known RSS feeds — suggestions, not an exhaustive list; any other feed address still works' })
  @ApiResponse({ status: 200, description: '[{ value: url, label, category }]' })
  feeds(@Query('q') q?: string, @Query('category') category?: string) {
    const needle = (q ?? '').trim().toLowerCase();
    return CURATED_FEEDS.filter(
      (f) => (!category || f.category === category) && (!needle || f.label.toLowerCase().includes(needle) || f.category.includes(needle)),
    );
  }
}
