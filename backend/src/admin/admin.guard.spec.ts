import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function makeContext(user: { isAdmin?: boolean } | undefined) {
  const req: any = { user };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('rejects when there is no user on the request at all', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('rejects a logged-in user who is not an admin', () => {
    expect(() => guard.canActivate(makeContext({ isAdmin: false }))).toThrow(ForbiddenException);
  });

  it('allows an admin through', () => {
    expect(guard.canActivate(makeContext({ isAdmin: true }))).toBe(true);
  });
});
