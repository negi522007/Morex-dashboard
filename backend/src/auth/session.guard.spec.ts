import { UnauthorizedException } from '@nestjs/common';
import { SessionGuard } from './session.guard';

function makeContext(cookies: Record<string, string>) {
  const req: any = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    _req: req,
  } as any;
}

describe('SessionGuard', () => {
  let authService: { getUserBySession: jest.Mock };
  let config: { get: jest.Mock };
  let guard: SessionGuard;

  beforeEach(() => {
    authService = { getUserBySession: jest.fn() };
    config = { get: jest.fn().mockReturnValue('dashboard_session') };
    guard = new SessionGuard(authService as any, config as any);
  });

  it('rejects when there is no session cookie at all', async () => {
    const ctx = makeContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.getUserBySession).not.toHaveBeenCalled();
  });

  it('rejects when the cookie holds a session that no longer resolves to a user', async () => {
    authService.getUserBySession.mockResolvedValue(null);
    const ctx = makeContext({ dashboard_session: 'stale-id' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows the request through and attaches req.user for a valid session', async () => {
    const user = { id: 'user-1', email: 'a@example.com' };
    authService.getUserBySession.mockResolvedValue(user);
    const ctx = makeContext({ dashboard_session: 'valid-id' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx._req.user).toEqual(user);
  });

  it('uses the configured cookie name, not a hardcoded one', async () => {
    config.get.mockReturnValue('custom_cookie_name');
    authService.getUserBySession.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
    const ctx = makeContext({ custom_cookie_name: 'valid-id', dashboard_session: 'wrong-one' });

    await guard.canActivate(ctx);
    expect(authService.getUserBySession).toHaveBeenCalledWith('valid-id');
  });
});
