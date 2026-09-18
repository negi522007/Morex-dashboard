import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WidgetBody, WidgetsService } from './widgets.service';

@ApiTags('widgets')
@ApiCookieAuth('dashboard_session')
@Controller('widgets')
@UseGuards(SessionGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's widget instances" })
  @ApiResponse({ status: 200, description: 'Array of widget instances' })
  list(@CurrentUser() user: { id: string }) {
    return this.widgetsService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a widget instance to the dashboard' })
  @ApiBody({
    schema: {
      example: {
        serviceName: 'rss',
        widgetName: 'article_list',
        config: { link: 'https://hnrss.org/frontpage', number: 3 },
        refreshRateSeconds: 60,
        position: { x: 0, y: 0, w: 4, h: 2 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({
    status: 400,
    description: 'Unknown service/widget, invalid config, refresh rate below 10s, or no credentials linked for a service that requires them',
  })
  create(@CurrentUser() user: { id: string }, @Body() body: WidgetBody) {
    return this.widgetsService.create(user.id, body);
  }

  // Reconfigure and move share one endpoint: both are "update mutable
  // fields on an existing instance" — no need for two routes.
  @Patch(':id')
  @ApiOperation({ summary: 'Reconfigure and/or move a widget instance — send only the fields that changed' })
  @ApiBody({ schema: { example: { position: { x: 2, y: 3, w: 4, h: 2 } } } })
  @ApiResponse({ status: 200, description: 'Updated instance' })
  @ApiResponse({ status: 400, description: 'Invalid config, refresh rate too low, or an empty body' })
  @ApiResponse({ status: 404, description: 'No such instance for this user' })
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: WidgetBody) {
    return this.widgetsService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a widget instance' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'No such instance for this user' })
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.widgetsService.remove(user.id, id);
  }
}
