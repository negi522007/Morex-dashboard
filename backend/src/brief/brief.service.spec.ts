import { BadRequestException } from '@nestjs/common';
import { BriefService } from './brief.service';

function make(available = true, answer: any = null) {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ language: 'fr' }) },
    brief: { findUnique: jest.fn(), upsert: jest.fn(async (a: any) => ({ ...a.create, generatedAt: new Date(0) })) },
    widgetInstance: { findMany: jest.fn() },
  };
  const completeJson = jest.fn(async (a: any) => answer ?? a.mock);
  const ai: any = { available, forUser: () => ({ available, completeJson }) };
  return { prisma, completeJson, svc: new BriefService(prisma, ai) };
}

describe('BriefService', () => {
  it('get returns the cached brief or null, plus availability', async () => {
    const { svc, prisma } = make(false);
    prisma.brief.findUnique.mockResolvedValue(null);
    expect(await svc.get('u')).toEqual({ available: false, brief: null });
  });

  it('refresh needs AI and at least one opted-in widget with data', async () => {
    await expect(make(false).svc.refresh('u')).rejects.toBeInstanceOf(BadRequestException);
    const { svc, prisma } = make();
    prisma.widgetInstance.findMany.mockResolvedValue([{ id: 'w', cachedData: null }]);
    await expect(svc.refresh('u')).rejects.toThrow(/at least one widget/);
  });

  it('reads only aiEnabled widgets, fences data, drops items about unknown widgets', async () => {
    const { svc, prisma, completeJson } = make(true, { headline: 'H', items: [{ id: 'w1', text: 'ok' }, { id: 'evil', text: 'x' }], tip: 't' });
    prisma.widgetInstance.findMany.mockResolvedValue([{ id: 'w1', serviceName: 'weather', widgetName: 'forecast', title: null, cachedData: { t: 3 } }]);
    const r: any = await svc.refresh('u');
    expect(prisma.widgetInstance.findMany.mock.calls[0][0].where).toEqual({ userId: 'u', aiEnabled: true });
    expect(completeJson.mock.calls[0][0].user).toMatch(/^<data>/);
    expect(r.brief.items).toEqual([{ widgetId: 'w1', text: 'ok' }]);
    expect(r.brief.language).toBe('fr');
  });
});
