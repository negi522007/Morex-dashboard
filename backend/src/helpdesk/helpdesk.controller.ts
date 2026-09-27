import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AskBody, HelpdeskService, asLang } from './helpdesk.service';

@ApiTags('helpdesk')
@Controller('helpdesk')
export class HelpdeskController {
  constructor(private readonly helpdesk: HelpdeskService) {}

  @Get('knowledge')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'PUBLIC. The whole help content (guides, services, widgets, glossary) in one language — for a help center page, tooltips and offline search' })
  @ApiResponse({ status: 200, description: '{ language, entries: [{ id, kind: "guide"|"service"|"widget"|"term", title, body, related: [{ id, title }] }] }' })
  knowledge(@Query('lang') lang?: string) {
    const l = asLang(lang) ?? 'en';
    return { language: l, entries: this.helpdesk.knowledge(l) };
  }

  @Get('search')
  @ApiOperation({ summary: 'PUBLIC. Keyword search over the help (no AI, instant): ?q=…&lang=fr&limit=5&service=youtube&widget=trending' })
  @ApiResponse({ status: 200, description: 'Same entry shape as /helpdesk/knowledge, best match first' })
  search(
    @Query('q') q?: string,
    @Query('lang') lang?: string,
    @Query('limit') limit?: string,
    @Query('service') service?: string,
    @Query('widget') widget?: string,
  ) {
    return this.helpdesk.search((q ?? '').slice(0, 200), asLang(lang) ?? 'en', Number(limit) || 5, { service, widget });
  }

  @Post('ask')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Ask the help assistant a question in plain words. Answers from the documentation only (AI when available, otherwise the best matching entry).' })
  @ApiBody({ schema: { example: { question: 'What is a JSON path?', history: [], context: { service: 'custom_api', widget: 'json_value' } } } })
  @ApiResponse({ status: 200, description: '{ mode: "ai"|"search", language, answer, sources: [{ id, title, kind }], followUps: string[], related: [{ id, title }] }' })
  @ApiResponse({ status: 400, description: 'Missing or too long question (max 400 characters)' })
  ask(@CurrentUser() user: { id: string }, @Body() body: AskBody, @Query('lang') lang?: string, @Req() _req?: unknown) {
    return this.helpdesk.ask(user.id, body, asLang(lang));
  }
}
