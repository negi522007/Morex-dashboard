import { GoogleOAuthController } from './google-oauth.controller';

describe('GET /auth/google/status', () => {
  const make = (env: Record<string, string | undefined>) =>
    new GoogleOAuthController({} as any, { get: (k: string) => env[k] } as any);

  it('is configured only when the client id, secret and callback URL are all set', () => {
    expect(make({}).status()).toEqual({ configured: false });
    expect(make({ GOOGLE_CLIENT_ID: 'id', GOOGLE_OAUTH_CALLBACK_URL: 'http://cb' }).status()).toEqual({ configured: false });
    expect(make({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', GOOGLE_OAUTH_CALLBACK_URL: 'http://cb' }).status()).toEqual({ configured: true });
  });
});
