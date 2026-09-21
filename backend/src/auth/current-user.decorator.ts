import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Only valid behind @UseGuards(SessionGuard), which is what attaches req.user.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string; email: string } }>();
  return req.user;
});
