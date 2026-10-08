import { BadRequestException, Controller, Delete, Get, HttpCode, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { setSessionCookie } from '../common/session-cookie.util';

// Mirrors GithubOAuthController exactly: two flows (link an existing account / sign in directly) sharing
// one Google OAuth client and callback URL, told apart by which state cookie is present on the way back.
const LINK_STATE_COOKIE = 'google_oauth_state';
const LOGIN_STATE_COOKIE = 'google_oauth_login_state';
const STATE_COOKIE_PATH = '/auth/google';
const STATE_TTL_MS = 10 * 60 * 1000;

@ApiTags('auth')
@Controller('auth/google')
export class GoogleOAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Same shape as /auth/github/status and friends: the frontend greys out its Google buttons instead of
  // sending people to a 400 page when this server has no Google OAuth client configured.
  @Get('status')
  @ApiOperation({ summary: 'Is "Connect / Sign in with Google" configured on this server? { configured }' })
  status() {
    return { configured: this.isConfigured() };
  }

  private isConfigured(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_CLIENT_ID') && this.config.get<string>('GOOGLE_CLIENT_SECRET') && this.config.get<string>('GOOGLE_OAUTH_CALLBACK_URL'));
  }

  // Linking, not login: requires an existing session — Google OAuth here is authorization added on top
  // of an account that already exists. For "Sign in with Google" itself, see /login below.
  @Get()
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({
    summary: 'Start the Google OAuth linking flow. Navigate the browser here directly — do not fetch() it.',
  })
  @ApiResponse({ status: 302, description: "Redirect to Google's consent screen" })
  @ApiResponse({ status: 400, description: 'Google OAuth is not configured on the server' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  startLink(@Res() res: Response) {
    this.redirectToGoogle(res, LINK_STATE_COOKIE);
  }

  // "Sign in with Google": no session required — this flow can create one.
  @Get('login')
  @ApiOperation({
    summary:
      'Start "Sign in with Google". Creates an account automatically (or links to a matching-email account) if none exists yet.',
  })
  @ApiResponse({ status: 302, description: "Redirect to Google's consent screen" })
  @ApiResponse({ status: 400, description: 'Google OAuth is not configured on the server' })
  startLogin(@Res() res: Response) {
    this.redirectToGoogle(res, LOGIN_STATE_COOKIE);
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: "Unlink the current user's Google account" })
  @ApiResponse({ status: 204, description: 'Unlinked' })
  @ApiResponse({ status: 401, description: 'No valid session' })
  @ApiResponse({ status: 404, description: 'No linked Google account for this user' })
  @ApiResponse({
    status: 409,
    description: 'This account has no password — unlinking would remove the only way to log in',
  })
  async unlink(@CurrentUser() user: { id: string }) {
    await this.authService.unlinkGoogleAccount(user.id);
  }

  @Get('callback')
  @ApiOperation({ summary: "Google's redirect target after consent — the frontend never calls this directly" })
  @ApiResponse({ status: 302, description: 'Back to the frontend: /dashboard (login), /dashboard?google=linked (link), or /login?error=… / /dashboard?google_error=… on failure' })
  async callback(@Query('code') code: string, @Query('state') state: string, @Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const linkStateCookie = req.cookies?.[LINK_STATE_COOKIE];
    const loginStateCookie = req.cookies?.[LOGIN_STATE_COOKIE];
    res.clearCookie(LINK_STATE_COOKIE, { path: STATE_COOKIE_PATH });
    res.clearCookie(LOGIN_STATE_COOKIE, { path: STATE_COOKIE_PATH });

    const failLink = (msg: string) => res.redirect(`${frontendUrl}/dashboard?google_error=${encodeURIComponent(msg)}`);
    const failLogin = (msg: string) => res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);

    if (!code || !state) {
      return linkStateCookie ? failLink('Missing code or state') : failLogin('Missing code or state');
    }

    if (linkStateCookie) {
      if (state !== linkStateCookie) return failLink('Invalid or expired OAuth state');
      const sessionCookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
      const sessionId = req.cookies?.[sessionCookieName];
      const user = sessionId ? await this.authService.getUserBySession(sessionId) : null;
      if (!user) return failLink('Your session expired before Google redirected back. Log in and try again.');
      try {
        await this.authService.linkGoogleAccount(user.id, code);
      } catch (err) {
        return failLink(err instanceof Error ? err.message : 'Google linking failed');
      }
      return res.redirect(`${frontendUrl}/dashboard?google=linked`);
    }

    if (loginStateCookie) {
      if (state !== loginStateCookie) return failLogin('Invalid or expired OAuth state');
      try {
        const { session } = await this.authService.loginWithGoogle(code);
        setSessionCookie(res, this.config, session.id, session.expiresAt);
        return res.redirect(`${frontendUrl}/dashboard`);
      } catch (err) {
        return failLogin(err instanceof Error ? err.message : 'Google sign-in failed');
      }
    }

    return failLogin('Invalid or expired OAuth state');
  }

  private redirectToGoogle(res: Response, stateCookieName: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.get<string>('GOOGLE_OAUTH_CALLBACK_URL');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('Google OAuth is not configured on the server');
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
      response_type: 'code',
      scope: 'openid email profile',
      state,
      // Without this, a returning user who already granted consent skips straight back with a code and
      // Google may omit the refresh token on subsequent authorizations — not used today (only the access
      // token from this exchange is stored), but consent re-prompting here costs nothing and keeps the
      // door open if a future widget needs a refresh token.
      prompt: 'consent',
      access_type: 'offline',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }
}
