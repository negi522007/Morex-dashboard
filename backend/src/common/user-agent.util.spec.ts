import { parseUserAgent } from './user-agent.util';

describe('parseUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36', 'Chrome', 'Linux'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0', 'Edge', 'Windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15', 'Safari', 'macOS'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', 'Safari', 'iOS'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0', 'Firefox', 'Android'],
    ['curl/8.5.0', 'API client', 'Unknown'],
  ])('%s', (ua, browser, os) => {
    expect(parseUserAgent(ua)).toEqual({ browser, os });
  });

  it('copes with a missing header', () => {
    expect(parseUserAgent(undefined)).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });
});
