import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiCookieAuth('dashboard_session')
@Controller('admin/users')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'List every platform user (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of users with counts of widgets/linked accounts/sessions' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  list() {
    return this.adminService.listUsers();
  }

  @Get(':id/widgets')
  @ApiOperation({ summary: "A user's widgets: service, widget, title, refresh rate, last refresh and last error (admin only). Never their config or data." })
  @ApiResponse({ status: 200, description: 'Array of { id, serviceName, widgetName, title, position, refreshRateSeconds, lastRefreshedAt, lastError, shared, createdAt }' })
  @ApiResponse({ status: 404, description: 'User not found' })
  widgets(@Param('id') id: string) {
    return this.adminService.listWidgets(id);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: "A user's valid sessions, most recently active first, named by browser and system (admin only). Never returns the session ids." })
  @ApiResponse({ status: 200, description: 'Array of { browser, os, createdAt, lastSeenAt, expiresAt }' })
  @ApiResponse({ status: 404, description: 'User not found' })
  sessions(@Param('id') id: string) {
    return this.adminService.listSessions(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: "Edit a user's name and/or manually flip emailVerified — not password, not admin/ban status (use the dedicated endpoints for those)",
  })
  @ApiBody({ schema: { example: { firstName: 'Ada', lastName: 'Lovelace', emailVerified: true } } })
  @ApiResponse({ status: 200, description: 'Updated user' })
  @ApiResponse({ status: 400, description: 'Empty body, or a blank name' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; emailVerified?: boolean },
  ) {
    return this.adminService.updateUser(id, body);
  }

  @Patch(':id/ban')
  @HttpCode(204)
  @ApiOperation({ summary: 'Suspend a user: blocks login and kills every existing session immediately. Emails them the reason and how to contest it.' })
  @ApiBody({ schema: { example: { reason: 'Spamming RSS widgets with the same feed across many accounts' } } })
  @ApiResponse({ status: 204, description: 'Banned' })
  @ApiResponse({ status: 400, description: 'Target is yourself, another admin, or reason is missing' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async ban(@CurrentUser() admin: { id: string }, @Param('id') id: string, @Body() body: { reason?: string }) {
    await this.adminService.ban(id, admin.id, body?.reason ?? '');
  }

  @Patch(':id/unban')
  @HttpCode(204)
  @ApiOperation({ summary: 'Lift a suspension' })
  @ApiResponse({ status: 204, description: 'Unbanned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unban(@Param('id') id: string) {
    await this.adminService.unban(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Permanently delete a user and everything of theirs (cascade). Emails them the reason and how to contest it, before the data is gone.' })
  @ApiBody({ schema: { example: { reason: 'Repeated harassment reported by other users' } } })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Target is yourself, another admin, or reason is missing' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@CurrentUser() admin: { id: string }, @Param('id') id: string, @Body() body: { reason?: string }) {
    await this.adminService.remove(id, admin.id, body?.reason ?? '');
  }
}

@ApiTags('admin')
@ApiCookieAuth('dashboard_session')
@Controller('admin/service-stats')
@UseGuards(SessionGuard, AdminGuard)
export class AdminServicesController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Usage and current health of each service: widgets, distinct accounts, widgets failing right now (admin only)' })
  @ApiResponse({ status: 200, description: 'Array of { service, widgets, users, errors, lastError }, most used first' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  list() {
    return this.adminService.serviceStats();
  }
}
