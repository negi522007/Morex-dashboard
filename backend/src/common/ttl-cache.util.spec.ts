import { TtlCache } from './ttl-cache.util';

describe('TtlCache', () => {
  it('answers repeated requests inside the TTL from memory', async () => {
    const cache = new TtlCache();
    const loader = jest.fn().mockResolvedValue('v1');
    expect(await cache.get('k', 1000, loader)).toBe('v1');
    expect(await cache.get('k', 1000, loader)).toBe('v1');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('shares one call between concurrent identical requests', async () => {
    const cache = new TtlCache();
    const loader = jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r('v'), 10)));
    await Promise.all([cache.get('k', 1000, loader), cache.get('k', 1000, loader), cache.get('k', 1000, loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads once the TTL has passed', async () => {
    const cache = new TtlCache();
    const loader = jest.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    await cache.get('k', 0, loader);
    expect(await cache.get('k', 0, loader)).toBe('new');
  });

  it('serves the last known value when the upstream fails after the TTL', async () => {
    const cache = new TtlCache();
    await cache.get('k', 0, jest.fn().mockResolvedValue('good'));
    const failing = jest.fn().mockRejectedValue(new Error('HTTP 429'));
    expect(await cache.get('k', 0, failing)).toBe('good');
  });

  it('propagates the error when there is nothing to fall back on', async () => {
    const cache = new TtlCache();
    await expect(cache.get('k', 1000, jest.fn().mockRejectedValue(new Error('HTTP 429')))).rejects.toThrow('HTTP 429');
  });

  it('does not cache failures', async () => {
    const cache = new TtlCache();
    await expect(cache.get('k', 1000, jest.fn().mockRejectedValue(new Error('x')))).rejects.toThrow();
    expect(await cache.get('k', 1000, jest.fn().mockResolvedValue('ok'))).toBe('ok');
  });
});
