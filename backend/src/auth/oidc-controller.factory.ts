import { BadRequestException, Controller, Delete, Get, HttpCode, Inject, Logger, Query, Req, Res, Type, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { setSessionCookie } from '../common/session-cookie.util';

// What a provider service must offer for the shared routes below.
export interface OidcFlow {
  isConfigured(): boolean;
  start(): Promise<{ url: string; state: string; nonce: string; verifier: string }>;
  link(userId: string, code: string, verifier: string, nonce: string): Promise<void>;
  login(code: string, verifier: string, nonce: string): Promise<{ id: string; expiresAt: Date }>;
  unlink(userId: string): Promise<void>;
}

const TTL_MS = 10 * 60 * 1000;

// The same six routes for every OpenID Connect provider (My Epitech, Microsoft):
//   GET status · GET (link, session needed) · GET login · DELETE (unlink) · GET callback.
// One cookie carries mode + CSRF state + nonce + PKCE verifier between the redirect out and the callback.
// The mode is read from that cookie (set by us), never from a query parameter the user could tamper with.
export function makeOidcController(opts: { route: string; label: string; cookie: string; flow: Type<OidcFlow> }): Type<unknown> {
  const path = `/${opts.route}`;
  const queryKey = opts.route.split('/').pop() as string; // "epitech" | "microsoft"

  @ApiTags('auth')
  @Controller(opts.route)
  class OidcController {
    private readonly logger = new Logger(`${opts.label}OidcController`);

    constructor(
      @Inject(opts.flow) private readonly oidc: OidcFlow,
      private readonly authService: AuthService,
      private readonly config: ConfigService,
    ) {}

    @Get('status')
    @ApiOperation({ summary: `Is "Connect with ${opts.label}" configured on this server? { configured }` })
    status() {
      return { configured: this.oidc.isConfigured() };
    }

    @Get()
    @UseGuards(SessionGuard)
    @ApiCookieAuth('dashboard_session')
    @ApiOperation({ summary: `Link ${opts.label} to the logged-in account. Navigate the browser here — do not fetch() it.` })
    @ApiResponse({ status: 302, description: `Redirect to ${opts.label}` })
    @ApiResponse({ status: 400, description: 'Not configured on the server' })
    async startLink(@Res() res: Response) {
      await this.redirect(res, 'link');
    }

    @Get('login')
    @ApiOperation({ summary: `"Sign in with ${opts.label}". Creates the account on first use, or attaches to the account with the same verified email.` })
    @ApiResponse({ status: 302, description: `Redirect to ${opts.label}` })
    async startLogin(@Res() res: Response) {
      await this.redirect(res, 'login');
    }

    @Delete()
    @HttpCode(204)
    @UseGuards(SessionGuard)
    @ApiCookieAuth('dashboard_session')
    @ApiOperation({ summary: `Unlink ${opts.label}` })
    @ApiResponse({ status: 404, description: 'Nothing linked' })
    @ApiResponse({ status: 409, description: 'It is the only way to log in to this account' })
    async unlink(@CurrentUser() user: { id: string }) {
      await this.oidc.unlink(user.id);
    }

    @Get('callback')
    @ApiOperation({ summary: `${opts.label}'s redirect target — the frontend never calls this directly` })
    @ApiResponse({ status: 302, description: `Back to the frontend: /dashboard (login), /dashboard?${queryKey}=linked (link), or /login?error=… / /dashboard?${queryKey}_error=… on failure` })
    async callback(@Query('code') code: string, @Query('state') state: string, @Query('error') error: string, @Query('error_description') errorDescription: string, @Req() req: Request, @Res() res: Response) {
      const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
      let saved: { mode: 'link' | 'login'; state: string; nonce: string; verifier: string } | null = null;
      try {
        saved = JSON.parse(req.cookies?.[opts.cookie] ?? 'null');
      } catch {
        saved = null;
      }
      res.clearCookie(opts.cookie, { path });
      if (!saved || !state || saved.state !== state) throw new BadRequestException('Invalid or expired OAuth state');

      const fail = (msg: string) =>
        res.redirect(saved!.mode === 'login' ? `${frontend}/login?error=${encodeURIComponent(msg)}` : `${frontend}/dashboard?${queryKey}_error=${encodeURIComponent(msg)}`);
      if (error) this.logger.warn(`${opts.label} returned an error on the callback: ${error} — ${errorDescription ?? 'no description'}`);
      if (error || !code) return fail(error ? `${opts.label} sign-in was cancelled` : 'Missing code');

      try {
        if (saved.mode === 'link') {
          const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
          const sessionId = req.cookies?.[cookieName];
          const user = sessionId ? await this.authService.getUserBySession(sessionId) : null;
          if (!user) return fail(`Your session expired before ${opts.label} redirected back — log in and try again`);
          await this.oidc.link(user.id, code, saved.verifier, saved.nonce);
          return res.redirect(`${frontend}/dashboard?${queryKey}=linked`);
        }
        const session = await this.oidc.login(code, saved.verifier, saved.nonce);
        setSessionCookie(res, this.config, session.id, session.expiresAt);
        return res.redirect(`${frontend}/dashboard`);
      } catch (err) {
        return fail(err instanceof Error ? err.message : `${opts.label} sign-in failed`);
      }
    }

    private async redirect(res: Response, mode: 'link' | 'login') {
      const { url, state, nonce, verifier } = await this.oidc.start();
      res.cookie(opts.cookie, JSON.stringify({ mode, state, nonce, verifier }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: this.config.get<string>('COOKIE_SECURE') === 'true',
        maxAge: TTL_MS,
        path,
      });
      res.redirect(url);
    }
  }
  return OidcController;
}
