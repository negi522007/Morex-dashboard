import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../../auth/session.guard';
import { ZODIAC_SIGNS } from '../../common/birth-date.util';
import { SIGN_INFO } from './data';

// Feeds the horoscope widget's "sign" dropdown (see WidgetParam.optionsUrl).
@ApiTags('services')
@ApiCookieAuth('dashboard_session')
@Controller('services/wellbeing')
@UseGuards(SessionGuard)
export class WellbeingController {
  @Get('signs')
  @ApiOperation({ summary: 'The 12 zodiac signs, named in the requested language — options for the horoscope widget' })
  @ApiResponse({ status: 200, description: '[{ value: "gemini", label: "Gémeaux", glyph: "♊", range: "05-21 → 06-20" }]' })
  signs(@Query('lang') lang?: string) {
    const i = lang === 'fr' ? 1 : lang === 'es' ? 2 : 0;
    return ZODIAC_SIGNS.map((s) => ({ value: s, label: SIGN_INFO[s].name[i], glyph: SIGN_INFO[s].glyph, range: SIGN_INFO[s].range }));
  }
}
