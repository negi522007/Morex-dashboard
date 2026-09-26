import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WellbeingService } from './wellbeing.service';

@ApiTags('wellbeing')
@ApiCookieAuth('dashboard_session')
@Controller('wellbeing')
@UseGuards(SessionGuard)
export class WellbeingController {
  constructor(private readonly wellbeing: WellbeingService) {}

  @Get('today')
  @ApiOperation({ summary: "Everything for the well-being page, for today: quote, horoscope (needs the user's birth date), breathing exercises, a tip, mood streak" })
  @ApiResponse({ status: 200, description: '{ date, language, quote, tip, breathing[], horoscope|null, needsBirthDate, mood }' })
  today(@CurrentUser() user: { id: string }, @Query('lang') lang?: string, @Query('offset') offset?: string) {
    // offset: "another quote" button — 0 = today's, 1 = next…
    return this.wellbeing.today(user.id, lang, Math.min(Math.max(Math.floor(Number(offset)) || 0, 0), 1000));
  }
}
