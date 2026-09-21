import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const cookieName = this.config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
    const sessionId = req.cookies?.[cookieName];

    if (!sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const user = await this.authService.getUserBySession(sessionId);
    if (!user) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    (req as Request & { user: typeof user }).user = user;
    return true;
  }
}
