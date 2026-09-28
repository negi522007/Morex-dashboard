import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExportService } from './export.service';

@ApiTags('auth')
@ApiCookieAuth('dashboard_session')
@Controller('auth/me')
@UseGuards(SessionGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // A plain GET answering with a file, so the frontend can use a normal link: the browser downloads it.
  @Get('export')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Download my data: profile, widgets and their settings, journal, alerts and linked accounts, as one JSON file (secrets stay masked)' })
  @ApiResponse({ status: 200, description: 'morex-my-data-YYYY-MM-DD.json (Content-Disposition: attachment)' })
  async download(@CurrentUser() user: { id: string }, @Res() res: Response) {
    const data = await this.exportService.exportFor(user.id);
    const day = data.exportedAt.slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="morex-my-data-${day}.json"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
