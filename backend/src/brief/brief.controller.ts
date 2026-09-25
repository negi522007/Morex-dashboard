import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BriefService } from './brief.service';

@ApiTags('brief')
@ApiCookieAuth('dashboard_session')
@Controller('brief')
@UseGuards(SessionGuard)
export class BriefController {
  constructor(private readonly brief: BriefService) {}

  @Get()
  @ApiOperation({ summary: "Today's AI brief in the user's language: { available, brief: {headline, items, tip, generatedAt}|null }" })
  get(@CurrentUser() user: { id: string }) {
    return this.brief.get(user.id);
  }

  @Post('refresh')
  @ApiOperation({ summary: "(Re)generate today's brief from the widgets that have AI turned on" })
  refresh(@CurrentUser() user: { id: string }) {
    return this.brief.refresh(user.id);
  }
}
