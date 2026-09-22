import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

// Must run after SessionGuard (@UseGuards(SessionGuard, AdminGuard)) — it
// only reads req.user.isAdmin, which SessionGuard is what attaches. No
// extra DB call needed: isAdmin already rides along on the session lookup
// SessionGuard already does (see AuthService.toPublicUser).
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: { isAdmin?: boolean } }>();
    if (!req.user?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
