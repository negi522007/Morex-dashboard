import { BadRequestException, Controller, Delete, Get, HttpCode, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { setSessionCookie } from '../common/session-cookie.util';

// Two different flows share one GitHub OAuth App (and therefore one
// registered callback URL), so they're told apart by which state cookie is
// present when GitHub redirects back — never by a route param, which the
// user could tamper with. Both cookies are scoped to /auth/github so they
// still reach /auth/github/callback, a sibling path.
const LINK_STATE_COOKIE = 'github_oauth_state';
const LOGIN_STATE_COOKIE = 'github_oauth_login_state';
const STATE_COOKIE_PATH = '/auth/github';
const STATE_TTL_MS = 10 * 60 * 1000;

@ApiTags('auth')
@Controller('auth/github')
export class GithubOAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Same shape as /auth/microsoft/status and /auth/epitech/status: the frontend greys out its GitHub buttons
  // instead of sending people to a 400 page when this server has no GitHub OAuth app.
  @Get('status')
  @ApiOperation({ summary: 'Is "Connect / Sign in with GitHub" configured on this server? { configured }' })
  status() {
    return { configured: this.isConfigured() };
  }

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>('GITHUB_CLIENT_ID') && this.config.get<string>('GITHUB_CLIENT_SECRET') && this.config.get<string>('GITHUB_OAUTH_CALLBACK_URL'));
  }

  // Linking, not login: this route requires an existing session — GitHub
  // OAuth here is authorization for widgets, added on top of an account
  // that already exists. For "Sign in with GitHub" itself, see /login below.
  @Get()
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({
    summary: 'Start the GitHub OAuth linking flow. Navigate the browser here directly — do not fetch() it.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub login/consent' })
  @ApiResponse({ status: 400, description: 'GitHub OAuth is not configured on the server' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  startLink(@Res() res: Response) {
    this.redirectToGithub(res, LINK_STATE_COOKIE);
  }

  // "Sign in with GitHub": no session required — this flow can create one.
  // Safe to point a plain <a href> at directly (real top-level navigation,
  // same reasoning as the link flow: GitHub's consent screen can't be
  // reached via fetch()).
  @Get('login')
  @ApiOperation({
    summary:
      'Start "Sign in with GitHub". Creates an account automatically (or links to a matching-email account) if none exists yet.',
  })
  @ApiResponse({ status: 302, description: 'Redirect to GitHub login/consent' })
  @ApiResponse({ status: 400, description: 'GitHub OAuth is not configured on the server' })
  startLogin(@Res() res: Response) {
    this.redirectToGithub(res, LOGIN_STATE_COOKIE);
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Unlink the current user\'s GitHub account' })
  @ApiResponse({ status: 204, description: 'Unlinked' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  @ApiResponse({ status: 404, description: 'No linked GitHub account for this user' })
  @ApiResponse({
    status: 409,
    description: 'This account has no password — unlinking would remove the only way to log in',
  })
  async unlink(@CurrentUser() user: { id: string }) {
    await this.authService.unlinkGithubAccount(user.id);
  }

  @Get('callback')
  @ApiOperation({ summary: "GitHub's redirect target after consent — the frontend never calls this directly" })
  @ApiResponse({ status: 200, description: 'Link flow: account linked, plain text response' })
  @ApiResponse({ status: 302, description: 'Login flow: session cookie set, redirected back to the frontend' })
  @ApiResponse({ status: 400, description: 'Invalid/expired CSRF state, or GitHub rejected the code' })
  @ApiResponse({ status: 409, description: 'Link flow: this GitHub account is already linked to a different user' })
  async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const linkStateCookie = req.cookies?.[LINK_STATE_COOKIE];
    const loginStateCookie = req.cookies?.[LOGIN_STATE_COOKIE];
    res.clearCookie(LINK_STATE_COOKIE, { path: STATE_COOKIE_PATH });
    res.clearCookie(LOGIN_STATE_COOKIE, { path: STATE_COOKIE_PATH });

    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }

    if (linkStateCookie) {
      if (state !== linkStateCookie) {
        throw new BadRequestException('Invalid or expired OAuth state');
      }
      const sessionCookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
      const sessionId = req.cookies?.[sessionCookieName];
      const user = sessionId ? await this.authService.getUserBySession(sessionId) : null;
      if (!user) {
        throw new BadRequestException('Your session expired before GitHub redirected back — log in and try again');
      }
      await this.authService.linkGithubAccount(user.id, code);
      return res.status(200).send('GitHub account linked. You can close this tab.');
    }

    if (loginStateCookie) {
      if (state !== loginStateCookie) {
        throw new BadRequestException('Invalid or expired OAuth state');
      }
      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      try {
        const { session } = await this.authService.loginWithGithub(code);
        setSessionCookie(res, this.config, session.id, session.expiresAt);
        return res.redirect(`${frontendUrl}/dashboard`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'GitHub sign-in failed';
        return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(message)}`);
      }
    }

    throw new BadRequestException('Invalid or expired OAuth state');
  }

  private redirectToGithub(res: Response, stateCookieName: string) {
    const clientId = this.config.get<string>('GITHUB_CLIENT_ID');
    const redirectUri = this.config.get<string>('GITHUB_OAUTH_CALLBACK_URL');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('GitHub OAuth is not configured on the server');
    }

    const state = randomBytes(16).toString('hex');
    res.cookie(stateCookieName, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      maxAge: STATE_TTL_MS,
      path: STATE_COOKIE_PATH,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }
}
