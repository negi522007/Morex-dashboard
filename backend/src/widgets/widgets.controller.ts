import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WidgetBody, WidgetsService } from './widgets.service';

@Controller('widgets')
@UseGuards(SessionGuard)
export class WidgetsController {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.widgetsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() body: WidgetBody) {
    return this.widgetsService.create(user.id, body);
  }

  // Reconfigure and move share one endpoint: both are "update mutable
  // fields on an existing instance" — no need for two routes.
  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: WidgetBody) {
    return this.widgetsService.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.widgetsService.remove(user.id, id);
  }
}
