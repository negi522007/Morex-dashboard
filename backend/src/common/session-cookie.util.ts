import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

// Shared by every place that establishes a session cookie (local login,
// "Sign in with GitHub") so the security-relevant flags can't drift apart
// between the two.
export function setSessionCookie(res: Response, config: ConfigService, sessionId: string, expiresAt: Date): void {
  const cookieName = config.get<string>('SESSION_COOKIE_NAME') ?? 'dashboard_session';
  res.cookie(cookieName, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    // Tied to an explicit flag, not NODE_ENV: this deploys over plain HTTP
    // (docker-compose has no TLS termination), and a real browser silently
    // drops "Secure" cookies on non-HTTPS connections.
    secure: config.get<string>('COOKIE_SECURE') === 'true',
    expires: expiresAt,
    path: '/',
  });
}
