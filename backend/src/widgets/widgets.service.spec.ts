import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WidgetsService } from './widgets.service';
import type { ServiceProvider } from '../services/service-provider.interface';

function makePrismaMock() {
  return {
    widgetInstance: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn((args: any) => ({ id: 'new-id', ...args.data })),
      update: jest.fn((args: any) => ({ id: args.where.id, ...args.data })),
      delete: jest.fn(),
    },
    oAuthAccount: { findFirst: jest.fn() },
    serviceSubscription: { findUnique: jest.fn() },
  };
}

const fakeProviders: ServiceProvider[] = [
  {
    name: 'rss',
    requiresAuth: false,
    widgets: [
      {
        name: 'article_list',
        description: 'test',
        params: [
          { name: 'link', type: 'string', required: true },
          { name: 'number', type: 'integer' },
        ],
        fetchData: async () => ({}),
      },
    ],
  },
  {
    name: 'github',
    requiresAuth: true,
    widgets: [
      {
        name: 'repo_stats',
        description: 'test',
        params: [{ name: 'repo', type: 'string', required: true }],
        fetchData: async () => ({}),
      },
    ],
  },
];

describe('WidgetsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: WidgetsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new WidgetsService(prisma as any, fakeProviders, { get: () => 'a'.repeat(64) } as any);
  });

  describe('secrets, AI and sharing', () => {
    const secretProviders: ServiceProvider[] = [
      {
        name: 'calendar',
        requiresAuth: false,
        widgets: [
          {
            name: 'upcoming_events',
            description: 't',
            shareable: false,
            params: [{ name: 'url', type: 'string', required: true, secret: true }],
            fetchData: async () => ({}),
          },
        ],
      },
      ...fakeProviders,
    ];
    let svc: WidgetsService;
    beforeEach(() => {
      svc = new WidgetsService(prisma as any, secretProviders, { get: () => 'a'.repeat(64) } as any);
    });

    it('stores secret params encrypted and returns them masked', async () => {
      const out: any = await svc.create('u', {
        serviceName: 'calendar', widgetName: 'upcoming_events', config: { url: 'https://x.test/secret.ics' }, refreshRateSeconds: 60,
      });
      const stored = prisma.widgetInstance.create.mock.calls[0][0].data.config;
      expect(stored.url).toMatch(/^enc:v1:/);
      expect(JSON.stringify(stored)).not.toContain('secret.ics');
      expect(out.config.url).toBe('********');
    });

    it('refuses to share a private widget', async () => {
      await expect(
        svc.create('u', { serviceName: 'calendar', widgetName: 'upcoming_events', config: { url: 'https://x.test/a.ics' }, refreshRateSeconds: 60, shared: true }),
      ).rejects.toThrow(/cannot be shared/);
    });

    it('keeps the stored secret when an update sends the mask', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({
        id: 'w', userId: 'u', serviceName: 'calendar', widgetName: 'upcoming_events', config: { url: 'enc:v1:stored' },
      });
      await svc.update('u', 'w', { config: { url: '********' } });
      expect(prisma.widgetInstance.update.mock.calls[0][0].data.config.url).toBe('enc:v1:stored');
    });

    it('resets the insight bookkeeping when AI is turned on', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({
        id: 'w', userId: 'u', serviceName: 'rss', widgetName: 'article_list', config: { link: 'https://a.test/f' },
      });
      await svc.update('u', 'w', { aiEnabled: true });
      const data = prisma.widgetInstance.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ aiEnabled: true, insightHash: null, lastRefreshedAt: null });
    });

    it('never exposes insightHash', async () => {
      prisma.widgetInstance.findMany.mockResolvedValue([
        { id: 'w', serviceName: 'rss', widgetName: 'article_list', config: { link: 'x' }, insightHash: 'h' },
      ]);
      const [row]: any[] = await svc.list('u');
      expect(row.insightHash).toBeUndefined();
    });

    it('validateDraft reports errors instead of throwing, and flags missing accounts', async () => {
      expect(await svc.validateDraft('u', { serviceName: 'rss', widgetName: 'article_list', config: {} })).toMatchObject({ ok: false });
      prisma.oAuthAccount.findFirst.mockResolvedValue(null);
      prisma.serviceSubscription.findUnique.mockResolvedValue(null);
      const r: any = await svc.validateDraft('u', { serviceName: 'github', widgetName: 'repo_stats', config: { repo: 'a/b' } });
      expect(r).toMatchObject({ ok: true, needsAccount: 'github' });
    });
  });

  describe('create', () => {
    it('rejects an unknown service', async () => {
      await expect(
        service.create('user-1', { serviceName: 'weather', widgetName: 'temp', refreshRateSeconds: 60 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown widget for a known service', async () => {
      await expect(
        service.create('user-1', { serviceName: 'rss', widgetName: 'nope', refreshRateSeconds: 60 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing required config param', async () => {
      await expect(
        service.create('user-1', { serviceName: 'rss', widgetName: 'article_list', config: {}, refreshRateSeconds: 60 }),
      ).rejects.toThrow(/Missing required parameter "link"/);
    });

    it('rejects a non-integer value for an integer param', async () => {
      await expect(
        service.create('user-1', {
          serviceName: 'rss',
          widgetName: 'article_list',
          config: { link: 'https://example.com/feed', number: 'not-a-number' },
          refreshRateSeconds: 60,
        }),
      ).rejects.toThrow(/must be an integer/);
    });

    it('rejects a refreshRateSeconds below the scheduler floor', async () => {
      await expect(
        service.create('user-1', {
          serviceName: 'rss',
          widgetName: 'article_list',
          config: { link: 'https://example.com/feed' },
          refreshRateSeconds: 1,
        }),
      ).rejects.toThrow(/refreshRateSeconds must be a number/);
    });

    it('rejects creating a widget for an auth-required service with no linked credentials', async () => {
      prisma.oAuthAccount.findFirst.mockResolvedValue(null);
      prisma.serviceSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          serviceName: 'github',
          widgetName: 'repo_stats',
          config: { repo: 'nestjs/nest' },
          refreshRateSeconds: 60,
        }),
      ).rejects.toThrow(/must connect your github account/);
    });

    it('creates the instance once credentials and config are both valid', async () => {
      prisma.oAuthAccount.findFirst.mockResolvedValue({ id: 'oauth-1' });

      const result = await service.create('user-1', {
        serviceName: 'github',
        widgetName: 'repo_stats',
        config: { repo: 'nestjs/nest' },
        refreshRateSeconds: 60,
      });

      expect(prisma.widgetInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            serviceName: 'github',
            widgetName: 'repo_stats',
            config: { repo: 'nestjs/nest' },
          }),
        }),
      );
      expect(result.id).toBe('new-id');
    });

    it('stores title and decoration when provided at creation time', async () => {
      await service.create('user-1', {
        serviceName: 'rss',
        widgetName: 'article_list',
        config: { link: 'https://example.com/feed' },
        refreshRateSeconds: 60,
        title: 'My Feed',
        decoration: 'stars',
      });
      expect(prisma.widgetInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: 'My Feed', decoration: 'stars' }) }),
      );
    });

    it('does not require credentials for a service that does not need auth', async () => {
      await service.create('user-1', {
        serviceName: 'rss',
        widgetName: 'article_list',
        config: { link: 'https://example.com/feed' },
        refreshRateSeconds: 60,
      });
      expect(prisma.oAuthAccount.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('404s instead of leaking existence when the instance belongs to someone else (or does not exist)', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue(null);
      await expect(service.update('user-1', 'someone-elses-id', { refreshRateSeconds: 30 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an empty update body', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        serviceName: 'rss',
        widgetName: 'article_list',
      });
      await expect(service.update('user-1', 'w1', {})).rejects.toThrow(/Nothing to update/);
    });

    it('re-validates config against the widget the instance already points to', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        serviceName: 'rss',
        widgetName: 'article_list',
      });
      await expect(service.update('user-1', 'w1', { config: {} })).rejects.toThrow(/Missing required parameter "link"/);
    });

    it('updates config, refreshRateSeconds, and position together', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({
        id: 'w1',
        userId: 'user-1',
        serviceName: 'rss',
        widgetName: 'article_list',
      });

      await service.update('user-1', 'w1', {
        config: { link: 'https://example.com/other-feed' },
        refreshRateSeconds: 120,
        position: { x: 1, y: 2 },
      });

      expect(prisma.widgetInstance.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: {
          config: { link: 'https://example.com/other-feed' },
          refreshRateSeconds: 120,
          position: { x: 1, y: 2 },
        },
      });
    });
  });

  describe('remove', () => {
    it('404s when the instance is not the caller\'s', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue(null);
      await expect(service.remove('user-1', 'not-mine')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.widgetInstance.delete).not.toHaveBeenCalled();
    });

    it('deletes the instance when it belongs to the caller', async () => {
      prisma.widgetInstance.findFirst.mockResolvedValue({ id: 'w1', userId: 'user-1' });
      await service.remove('user-1', 'w1');
      expect(prisma.widgetInstance.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
    });
  });

  describe('list', () => {
    it('scopes the query to the given user', async () => {
      prisma.widgetInstance.findMany.mockResolvedValue([]);
      await service.list('user-1');
      expect(prisma.widgetInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
