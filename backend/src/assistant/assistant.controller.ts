import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiCookieAuth('dashboard_session')
@Controller('assistant')
@UseGuards(SessionGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('widgets')
  @ApiOperation({ summary: 'Describe what you want to follow; get validated widget drafts (nothing is created)' })
  @ApiBody({ schema: { example: { prompt: 'follow the bitcoin price and tech news' } } })
  suggest(@CurrentUser() user: { id: string }, @Body() body: { prompt?: string }) {
    return this.assistant.suggest(user.id, body?.prompt);
  }
}
