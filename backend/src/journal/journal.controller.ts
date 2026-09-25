import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JournalService } from './journal.service';

@ApiTags('journal')
@ApiCookieAuth('dashboard_session')
@Controller('journal')
@UseGuards(SessionGuard)
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's journal entries, newest first" })
  @ApiResponse({ status: 200, description: 'Array of entries, text decrypted' })
  list(@CurrentUser() user: { id: string }) {
    return this.journalService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new journal entry' })
  @ApiBody({ schema: { example: { mood: '😊', text: 'Dear journal...' } } })
  @ApiResponse({ status: 201, description: 'Created' })
  create(@CurrentUser() user: { id: string }, @Body() body: { date?: string; mood?: string; text?: string }) {
    return this.journalService.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an entry\'s mood and/or text' })
  @ApiBody({ schema: { example: { text: 'Updated entry text' } } })
  @ApiResponse({ status: 200, description: 'Updated entry' })
  @ApiResponse({ status: 404, description: 'No such entry for this user' })
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: { mood?: string; text?: string }) {
    return this.journalService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an entry' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'No such entry for this user' })
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.journalService.remove(user.id, id);
  }
}
