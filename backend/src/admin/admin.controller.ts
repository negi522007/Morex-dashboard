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
  @ApiOperation({ summary: 'Suspend a user: blocks login and kills every existing session immediately' })
  @ApiResponse({ status: 204, description: 'Banned' })
  @ApiResponse({ status: 400, description: 'Target is yourself, or another admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async ban(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    await this.adminService.ban(id, admin.id);
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
  @ApiOperation({ summary: 'Permanently delete a user and everything of theirs (cascade)' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Target is yourself, or another admin' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    await this.adminService.remove(id, admin.id);
  }
}
