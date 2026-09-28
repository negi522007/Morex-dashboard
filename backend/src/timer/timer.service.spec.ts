import { TimerService } from './timer.service';
import type { ServiceProvider } from '../services/service-provider.interface';
import { encryptToken } from '../common/token-encryption.util';

function makePrismaMock() {
  return {
    $queryRaw: jest.fn(),
    widgetInstance: { update: jest.fn() },
    oAuthAccount: { findFirst: jest.fn() },
    serviceSubscription: { findUnique: jest.fn() },
  };
}

const KEY = 'a'.repeat(64);

describe('TimerService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let config: { get: jest.Mock };
  let fetchDataMock: jest.Mock;
  let providers: ServiceProvider[];
  let service: TimerService;

  beforeEach(() => {
    prisma = makePrismaMock();
    config = { get: jest.fn().mockReturnValue(KEY) };
    fetchDataMock = jest.fn().mockResolvedValue({ ok: true });
    providers = [
      {
        name: 'test-service',
        requiresAuth: false,
        widgets: [{ name: 'widget-a', description: '', params: [], fetchData: fetchDataMock }],
      },
    ];
    service = new TimerService(prisma as any, config as any, providers);
  });

  it('does nothing when no instance is due', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await service.handleTick();
    expect(prisma.widgetInstance.update).not.toHaveBeenCalled();
  });

  it('fetches and caches data for a due instance', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: { x: 1 } },
    ]);

    await service.handleTick();

    expect(fetchDataMock).toHaveBeenCalledWith({ x: 1 }, undefined);
    expect(prisma.widgetInstance.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { cachedData: { ok: true }, lastRefreshedAt: expect.any(Date), lastError: null },
    });
  });

  it('keeps updating lastRefreshedAt but leaves cachedData alone when fetchData throws, and records the exact error', async () => {
    fetchDataMock.mockRejectedValue(new Error('boom'));
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: {} },
    ]);

    await service.handleTick();

    expect(prisma.widgetInstance.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { lastRefreshedAt: expect.any(Date), lastError: 'boom' },
    });
  });

  it('handles an unknown service/widget without crashing, and still bumps lastRefreshedAt', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'does-not-exist', widgetName: 'nope', config: {} },
    ]);

    await service.handleTick();

    expect(fetchDataMock).not.toHaveBeenCalled();
    expect(prisma.widgetInstance.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { lastRefreshedAt: expect.any(Date), lastError: expect.stringContaining('does-not-exist/nope') },
    });
  });

  it('resolves auth from a linked OAuthAccount, decrypted, when the service requires it', async () => {
    const encrypted = encryptToken('gho_realtoken', KEY);
    providers[0].requiresAuth = true;
    prisma.oAuthAccount.findFirst.mockResolvedValue({ accessTokenEncrypted: encrypted });
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: {} },
    ]);

    await service.handleTick();

    expect(fetchDataMock).toHaveBeenCalledWith({}, { accessToken: 'gho_realtoken' });
  });

  it('falls back to a decrypted ServiceSubscription when there is no OAuthAccount', async () => {
    const encrypted = encryptToken(JSON.stringify({ apiKey: 'xyz' }), KEY);
    providers[0].requiresAuth = true;
    prisma.oAuthAccount.findFirst.mockResolvedValue(null);
    prisma.serviceSubscription.findUnique.mockResolvedValue({ credentialsEncrypted: encrypted });
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: {} },
    ]);

    await service.handleTick();

    expect(fetchDataMock).toHaveBeenCalledWith({}, { credentials: { apiKey: 'xyz' } });
  });

  it('stops a widget whose account was disconnected: no fetch, and its data is cleared', async () => {
    providers[0].requiresAuth = true;
    prisma.oAuthAccount.findFirst.mockResolvedValue(null);
    prisma.serviceSubscription.findUnique.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([
      { id: 'w1', userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: {} },
    ]);

    await service.handleTick();

    expect(fetchDataMock).not.toHaveBeenCalled();
    expect(prisma.widgetInstance.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { cachedData: expect.anything(), lastRefreshedAt: expect.any(Date), lastError: expect.stringContaining('not connected anymore') },
    });
  });

  it('refreshes several widgets at the same time, so a slow one does not hold up the others', async () => {
    let inFlight = 0, maxInFlight = 0;
    fetchDataMock.mockImplementation(async () => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return { ok: true };
    });
    prisma.$queryRaw.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, userId: 'u1', serviceName: 'test-service', widgetName: 'widget-a', config: {} })),
    );
    await service.handleTick();
    expect(fetchDataMock).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(8);
  });

  it('skips a tick that starts while the previous one is still running', async () => {
    let resolveFirst!: () => void;
    const firstQuery = new Promise<any[]>((resolve) => {
      resolveFirst = () => resolve([]);
    });
    prisma.$queryRaw.mockReturnValueOnce(firstQuery).mockResolvedValue([]);

    const firstTick = service.handleTick();
    const secondTick = service.handleTick(); // starts while the first is still awaiting $queryRaw

    resolveFirst();
    await Promise.all([firstTick, secondTick]);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
