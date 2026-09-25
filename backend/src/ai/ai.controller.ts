import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(SessionGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  // Lets the frontend decide whether to show AI toggles at all, and how much quota is left.
  @Get('status')
  async status(@CurrentUser() user: { id: string }) {
    const s = this.ai.status();
    const used = s.available && s.provider !== 'mock' ? await this.ai.usageToday(user.id) : 0;
    return { ...s, usedToday: used, remainingToday: Math.max(0, s.dailyCallsPerUser - used) };
  }
}
