import { NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

const providers: any[] = [
  { name: 'rss', requiresAuth: false, widgets: [{ name: 'article_list', params: [] }] },
  { name: 'calendar', requiresAuth: false, widgets: [{ name: 'upcoming_events', params: [], shareable: false }] },
];
const TOKEN = 'a'.repeat(48);

function make() {
  const prisma: any = {
    shareLink: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    widgetInstance: { findMany: jest.fn() },
  };
  return { prisma, svc: new ShareService(prisma, providers) };
}

describe('ShareService', () => {
  it('enable creates a 48-hex token (and a second call rotates it)', async () => {
    const { svc, prisma } = make();
    const a = await svc.enable('u');
    const b = await svc.enable('u');
    expect(a.token).toMatch(/^[a-f0-9]{48}$/);
    expect(b.token).not.toBe(a.token);
    expect(a.path).toBe(`/public/dashboard/${a.token}`);
    expect(prisma.shareLink.upsert).toHaveBeenCalledTimes(2);
  });

  it('get reports disabled when there is no link', async () => {
    const { svc, prisma } = make();
    prisma.shareLink.findUnique.mockResolvedValue(null);
    expect(await svc.get('u')).toEqual({ enabled: false, token: null, path: null });
  });

  it('public view returns only shared + shareable widgets, without config or email', async () => {
    const { svc, prisma } = make();
    prisma.shareLink.findUnique.mockResolvedValue({ userId: 'u', user: { firstName: 'Ann', theme: 'galaxy', widgetSkin: 'glass' } });
    prisma.widgetInstance.findMany.mockResolvedValue([
      { id: '1', serviceName: 'rss', widgetName: 'article_list', title: 't', decoration: null, position: {}, cachedData: [1], insight: { x: 1 }, aiEnabled: true, lastRefreshedAt: null, config: { link: 'secret' } },
      { id: '2', serviceName: 'calendar', widgetName: 'upcoming_events', title: null, decoration: null, position: {}, cachedData: [], insight: null, aiEnabled: false, lastRefreshedAt: null, config: { url: 'secret' } },
    ]);
    const r: any = await svc.publicDashboard(TOKEN);
    expect(prisma.widgetInstance.findMany.mock.calls[0][0].where).toEqual({ userId: 'u', shared: true });
    expect(r.widgets.map((w: any) => w.id)).toEqual(['1']);
    expect(JSON.stringify(r)).not.toContain('secret');
    expect(r.owner).toEqual({ firstName: 'Ann' });
  });

  it('404s on malformed or unknown tokens without touching the DB for malformed ones', async () => {
    const { svc, prisma } = make();
    await expect(svc.publicDashboard('../x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.shareLink.findUnique).not.toHaveBeenCalled();
    prisma.shareLink.findUnique.mockResolvedValue(null);
    await expect(svc.publicDashboard(TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });
});
