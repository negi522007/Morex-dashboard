import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AlertBody, AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiCookieAuth('dashboard_session')
@Controller('alerts')
@UseGuards(SessionGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({ summary: "List the user's alerts" })
  list(@CurrentUser() user: { id: string }) {
    return this.alerts.list(user.id);
  }

  // Declared before ':id' routes so "events" is never read as an id.
  @Get('events')
  @ApiOperation({ summary: 'Recent alert firings (in-app notifications), newest first' })
  events(@CurrentUser() user: { id: string }, @Query('limit') limit?: string) {
    return this.alerts.events(user.id, Number(limit) || 30);
  }

  @Post()
  @ApiOperation({ summary: 'Alert me (in-app + email) when a widget value goes above/below a threshold' })
  @ApiBody({ schema: { example: { widgetId: 'uuid', operator: 'above', threshold: 100000, cooldownMinutes: 60, label: 'BTC > 100k' } } })
  @ApiResponse({ status: 400, description: 'Bad operator/threshold, or the widget has no numeric value' })
  @ApiResponse({ status: 404, description: 'No such widget for this user' })
  create(@CurrentUser() user: { id: string }, @Body() body: AlertBody) {
    return this.alerts.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit, pause (active:false) or re-arm (active:true) an alert' })
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: AlertBody) {
    return this.alerts.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.alerts.remove(user.id, id);
  }
}
