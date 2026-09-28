import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { searchChannels } from './youtube-search.util';

// Feeds the "channel" field's type-ahead (see WidgetParam.optionsUrl). Deliberately expensive per the
// comment in youtube.provider.ts (uses the "search" endpoint), so it only fires from 3 characters and is
// cached a day per query — see youtube-search.util.ts.
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/youtube')
@UseGuards(SessionGuard)
export class YoutubeChannelsController {
  constructor(private readonly config: ConfigService) {}

  @Get('channels')
  @ApiOperation({ summary: 'Search YouTube channels by name — type-ahead, only from 3 characters (cached, costs real quota)' })
  @ApiResponse({ status: 200, description: '[{ value: "@handle", label: "Channel name", subscribers: 176000 }]' })
  async channels(@Query('q') q?: string, @Query('limit') limit?: string) {
    const apiKey = this.config.get<string>('YOUTUBE_API_KEY');
    if (!apiKey) return [];
    try {
      return await searchChannels(q ?? '', apiKey, Number(limit) || 8);
    } catch {
      // A transient YouTube error here just means no suggestions — the field still accepts free typing.
      return [];
    }
  }
}
