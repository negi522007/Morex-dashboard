import { GithubOAuthController } from './github-oauth.controller';

describe('GET /auth/github/status', () => {
  const make = (env: Record<string, string | undefined>) =>
    new GithubOAuthController({} as any, { get: (k: string) => env[k] } as any);

  it('is configured only when the client id, secret and callback URL are all set', () => {
    expect(make({}).status()).toEqual({ configured: false });
    expect(make({ GITHUB_CLIENT_ID: 'id', GITHUB_OAUTH_CALLBACK_URL: 'http://cb' }).status()).toEqual({ configured: false });
    expect(make({ GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 's', GITHUB_OAUTH_CALLBACK_URL: 'http://cb' }).status()).toEqual({ configured: true });
  });
});
