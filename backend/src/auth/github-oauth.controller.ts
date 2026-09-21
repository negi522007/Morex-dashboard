import { BadRequestException, Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';

const STATE_COOKIE = 'github_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

@ApiTags('auth')
@ApiCookieAuth('dashboard_session')
@Controller('auth/github')
@UseGuards(SessionGuard)
export class GithubOAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Linking, not login: this route requires an existing session (see class
  // decorator) — GitHub OAuth here is authorization for widgets, not an
  // alternate way to authenticate.
  @Get()
  @ApiOperation({
    summary: 'Start the GitHub OAuth linking flow. Navigate the browser here directly — do not fetch() it.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub login/consent' })
  @ApiResponse({ status: 400, description: 'GitHub OAuth is not configured on the server' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  start(@Res() res: Response) {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = this.config.get<string>('GITHUB_OAUTH_CALLBACK_URL');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('GitHub OAuth is not configured on the server');
    }

    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      maxAge: STATE_TTL_MS,
      path: '/auth/github',
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }

  @Get('callback')
  @ApiOperation({ summary: "GitHub's redirect target after consent — the frontend never calls this directly" })
  @ApiResponse({ status: 200, description: 'GitHub account linked, plain text response' })
  @ApiResponse({ status: 400, description: 'Invalid/expired CSRF state, or GitHub rejected the code' })
  @ApiResponse({ status: 409, description: 'This GitHub account is already linked to a different user' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @CurrentUser() user: { id: string; email: string },
    @Res() res: Response,
  ) {
    const cookieState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: '/auth/github' });

    if (!code || !state || !cookieState || state !== cookieState) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    await this.authService.linkGithubAccount(user.id, code);
    res.status(200).send('GitHub account linked. You can close this tab.');
  }
}
