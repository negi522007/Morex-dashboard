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
  @ApiResponse({ status: 302, description: 'Back to the frontend: /dashboard (login), /dashboard?github=linked (link), or /login?error=… / /dashboard?github_error=… on failure' })
  async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const linkStateCookie = req.cookies?.[LINK_STATE_COOKIE];
    const loginStateCookie = req.cookies?.[LOGIN_STATE_COOKIE];
    res.clearCookie(LINK_STATE_COOKIE, { path: STATE_COOKIE_PATH });
    res.clearCookie(LOGIN_STATE_COOKIE, { path: STATE_COOKIE_PATH });

    // Always land back in the app, never a bare error page — same pattern as the Epitech/Microsoft
    // callbacks: /dashboard for the link flow (with a query flag the frontend can toast), /login for
    // the login flow (which has nowhere else to send a not-yet-authenticated visitor).
    const failLink = (msg: string) => res.redirect(`${frontendUrl}/dashboard?github_error=${encodeURIComponent(msg)}`);
    const failLogin = (msg: string) => res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);

    if (!code || !state) {
      return linkStateCookie ? failLink('Missing code or state') : failLogin('Missing code or state');
    }

    if (linkStateCookie) {
      if (state !== linkStateCookie) return failLink('Invalid or expired OAuth state');
      const sessionCookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
      const sessionId = req.cookies?.[sessionCookieName];
      const user = sessionId ? await this.authService.getUserBySession(sessionId) : null;
      if (!user) return failLink('Your session expired before GitHub redirected back. Log in and try again.');
      try {
        await this.authService.linkGithubAccount(user.id, code);
      } catch (err) {
        return failLink(err instanceof Error ? err.message : 'GitHub linking failed');
      }
      return res.redirect(`${frontendUrl}/dashboard?github=linked`);
    }

    if (loginStateCookie) {
      if (state !== loginStateCookie) return failLogin('Invalid or expired OAuth state');
      try {
        const { session } = await this.authService.loginWithGithub(code);
        setSessionCookie(res, this.config, session.id, session.expiresAt);
        return res.redirect(`${frontendUrl}/dashboard`);
      } catch (err) {
        return failLogin(err instanceof Error ? err.message : 'GitHub sign-in failed');
      }
    }

    return failLogin('Invalid or expired OAuth state');
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
