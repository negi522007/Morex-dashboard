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
  @ApiOperation({ summary: 'Chat to build widgets: send a message (and the conversation so far); get a reply and, once the assistant has enough, validated drafts (nothing is created)' })
  @ApiBody({ schema: { example: { prompt: 'I want to follow some cool stuff', history: [{ role: 'assistant', content: 'What kind of content are you into?' }] } } })
  suggest(@CurrentUser() user: { id: string }, @Body() body: { prompt?: string; history?: unknown }) {
    return this.assistant.suggest(user.id, body);
  }
}
