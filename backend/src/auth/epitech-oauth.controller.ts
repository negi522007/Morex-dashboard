import { BadRequestException, Controller, Delete, Get, HttpCode, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { EpitechOidcService } from './epitech-oidc.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { setSessionCookie } from '../common/session-cookie.util';

// One cookie carries mode + CSRF state + nonce + PKCE verifier between the
// redirect out and the callback. Mode is read from this cookie (set by us),
// never from a query parameter the user could tamper with.
const COOKIE = 'epitech_oidc';
const COOKIE_PATH = '/auth/epitech';
const TTL_MS = 10 * 60 * 1000;

@ApiTags('auth')
@Controller('auth/epitech')
export class EpitechOAuthController {
  constructor(
    private readonly oidc: EpitechOidcService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Is "Connect with My Epitech" configured on this server? { configured }' })
  status() {
    return { configured: this.oidc.isConfigured() };
  }

  @Get()
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Link My Epitech to the logged-in account (login via Microsoft happens on Epitech\'s side). Navigate the browser here — do not fetch() it.' })
  @ApiResponse({ status: 302, description: 'Redirect to My Epitech' })
  @ApiResponse({ status: 400, description: 'Not configured on the server' })
  async startLink(@Res() res: Response) {
    await this.redirect(res, 'link');
  }

  @Get('login')
  @ApiOperation({ summary: '"Sign in with My Epitech". Creates the account on first use, or attaches to the account with the same verified email.' })
  @ApiResponse({ status: 302, description: 'Redirect to My Epitech' })
  async startLogin(@Res() res: Response) {
    await this.redirect(res, 'login');
  }

  @Delete()
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @ApiCookieAuth('dashboard_session')
  @ApiOperation({ summary: 'Unlink My Epitech' })
  @ApiResponse({ status: 404, description: 'Nothing linked' })
  @ApiResponse({ status: 409, description: 'It is the only way to log in to this account' })
  async unlink(@CurrentUser() user: { id: string }) {
    await this.oidc.unlink(user.id);
  }

  @Get('callback')
  @ApiOperation({ summary: "My Epitech's redirect target — the frontend never calls this directly" })
  @ApiResponse({ status: 302, description: 'Back to the frontend: /dashboard (login), /dashboard?epitech=linked (link), or /login?error=… / /dashboard?epitech_error=… on failure' })
  async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Req() req: Request, @Res() res: Response) {
    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    let saved: { mode: 'link' | 'login'; state: string; nonce: string; verifier: string } | null = null;
    try {
      saved = JSON.parse(req.cookies?.[COOKIE] ?? 'null');
    } catch {
      saved = null;
    }
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
    if (!saved || !state || saved.state !== state) throw new BadRequestException('Invalid or expired OAuth state');

    const fail = (msg: string) =>
      res.redirect(saved!.mode === 'login' ? `${frontend}/login?error=${encodeURIComponent(msg)}` : `${frontend}/dashboard?epitech_error=${encodeURIComponent(msg)}`);
    if (error || !code) return fail(error ? 'My Epitech sign-in was cancelled' : 'Missing code');

    try {
      if (saved.mode === 'link') {
        const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
        const sessionId = req.cookies?.[cookieName];
        const user = sessionId ? await this.authService.getUserBySession(sessionId) : null;
        if (!user) return fail('Your session expired before My Epitech redirected back — log in and try again');
        await this.oidc.link(user.id, code, saved.verifier, saved.nonce);
        return res.redirect(`${frontend}/dashboard?epitech=linked`);
      }
      const session = await this.oidc.login(code, saved.verifier, saved.nonce);
      setSessionCookie(res, this.config, session.id, session.expiresAt);
      return res.redirect(`${frontend}/dashboard`);
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'My Epitech sign-in failed');
    }
  }

  private async redirect(res: Response, mode: 'link' | 'login') {
    const { url, state, nonce, verifier } = await this.oidc.start();
    res.cookie(COOKIE, JSON.stringify({ mode, state, nonce, verifier }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      maxAge: TTL_MS,
      path: COOKIE_PATH,
    });
    res.redirect(url);
  }
}
