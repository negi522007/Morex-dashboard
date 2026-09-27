import { fetchWithTimeout } from './fetch-timeout.util';

describe('fetchWithTimeout', () => {
  afterEach(() => jest.restoreAllMocks());

  it('passes url and options through and adds an abort signal', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('ok'));
    await fetchWithTimeout('https://a.test/x', { headers: { A: '1' } }, 500);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://a.test/x');
    expect(init.headers).toEqual({ A: '1' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects when the server is slower than the timeout', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((_u, init) =>
      new Promise((_res, rej) => (init as RequestInit).signal!.addEventListener('abort', () => rej((init as RequestInit).signal!.reason))),
    );
    await expect(fetchWithTimeout('https://a.test/slow', {}, 20)).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
