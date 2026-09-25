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
    service = new WidgetsService(prisma as any, fakeProviders);
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
    it('scopes the query to the given user', () => {
      service.list('user-1');
      expect(prisma.widgetInstance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
