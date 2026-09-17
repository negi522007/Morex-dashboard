import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() body: { email?: string; password?: string }) {
    const { email, password } = this.validateCredentials(body);
    return this.authService.register(email, password);
  }

  @Get('confirm')
  async confirm(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      throw new BadRequestException('Missing confirmation token');
    }
    await this.authService.confirmEmail(token);
    res.status(200).send('Email confirmed. You can now log in.');
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = this.validateCredentials(body);
    const { session, user } = await this.authService.login(email, password);
    this.setSessionCookie(res, session.id, session.expiresAt);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
    const sessionId = req.cookies?.[cookieName];
    await this.authService.logout(sessionId);
    res.clearCookie(cookieName);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }

  private validateCredentials(body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !EMAIL_RE.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    return { email, password };
  }

  private setSessionCookie(res: Response, sessionId: string, expiresAt: Date) {
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
    // Tied to an explicit flag, not NODE_ENV: this deploys over plain HTTP
    // (docker-compose has no TLS termination), and a real browser silently
    // drops "Secure" cookies on non-HTTPS connections. Flip COOKIE_SECURE=true
    // once the app is actually served over HTTPS.
    res.cookie(cookieName, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE') === 'true',
      expires: expiresAt,
      path: '/',
    });
  }
}
