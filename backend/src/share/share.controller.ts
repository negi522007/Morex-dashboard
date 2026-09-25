import { Controller, Delete, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ShareService } from './share.service';

@ApiTags('share')
@ApiCookieAuth('dashboard_session')
@Controller('share')
@UseGuards(SessionGuard)
export class ShareController {
  constructor(private readonly share: ShareService) {}

  @Get()
  @ApiOperation({ summary: 'Current public link state: { enabled, token, path }' })
  get(@CurrentUser() user: { id: string }) {
    return this.share.get(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create the public read-only link — or rotate it (the old URL stops working)' })
  enable(@CurrentUser() user: { id: string }) {
    return this.share.enable(user.id);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Turn the public link off' })
  async disable(@CurrentUser() user: { id: string }) {
    await this.share.disable(user.id);
  }
}

@ApiTags('share')
@Controller('public')
export class PublicController {
  constructor(private readonly share: ShareService) {}

  @Get('dashboard/:token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @ApiOperation({ summary: 'PUBLIC (no login): the read-only dashboard behind a share token' })
  dashboard(@Param('token') token: string) {
    return this.share.publicDashboard(token);
  }
}
