import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';

const providers: any[] = [
  { name: 'weather', requiresAuth: false, widgets: [{ name: 'forecast', params: [], primaryMetric: () => 1, fetchData: jest.fn() }] },
  { name: 'rss', requiresAuth: false, widgets: [{ name: 'article_list', params: [], fetchData: jest.fn() }] },
];

function make() {
  const prisma: any = {
    widgetInstance: { findFirst: jest.fn() },
    alert: {
      findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0),
      create: jest.fn((a: any) => ({ id: 'a1', ...a.data })), update: jest.fn((a: any) => ({ id: a.where.id, ...a.data })), delete: jest.fn(),
    },
    alertEvent: { findMany: jest.fn() },
  };
  return { prisma, svc: new AlertsService(prisma, providers) };
}

describe('AlertsService', () => {
  it('creates an alert on a numeric widget of the caller', async () => {
    const { svc, prisma } = make();
    prisma.widgetInstance.findFirst.mockResolvedValue({ id: 'w', serviceName: 'weather', widgetName: 'forecast' });
    const a = await svc.create('u', { widgetId: 'w', operator: 'above', threshold: '30' as any, label: 'Hot' });
    expect(a).toMatchObject({ userId: 'u', widgetId: 'w', operator: 'above', threshold: 30, cooldownMinutes: 60, label: 'Hot' });
  });

  it('rejects widgets of others, non-numeric widgets, and bad input', async () => {
    const { svc, prisma } = make();
    prisma.widgetInstance.findFirst.mockResolvedValue(null);
    await expect(svc.create('u', { widgetId: 'x', operator: 'above', threshold: 1 })).rejects.toBeInstanceOf(NotFoundException);
    prisma.widgetInstance.findFirst.mockResolvedValue({ id: 'w', serviceName: 'rss', widgetName: 'article_list' });
    await expect(svc.create('u', { widgetId: 'w', operator: 'above', threshold: 1 })).rejects.toThrow(/no numeric value/);
    prisma.widgetInstance.findFirst.mockResolvedValue({ id: 'w', serviceName: 'weather', widgetName: 'forecast' });
    await expect(svc.create('u', { widgetId: 'w', operator: 'equal', threshold: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create('u', { widgetId: 'w', operator: 'below', threshold: NaN })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create('u', { widgetId: 'w', operator: 'below', threshold: 1, cooldownMinutes: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('caps the number of alerts per user', async () => {
    const { svc, prisma } = make();
    prisma.widgetInstance.findFirst.mockResolvedValue({ id: 'w', serviceName: 'weather', widgetName: 'forecast' });
    prisma.alert.count.mockResolvedValue(50);
    await expect(svc.create('u', { widgetId: 'w', operator: 'above', threshold: 1 })).rejects.toThrow(/at most 50/);
  });

  it('re-arms on active:true, and scopes update/remove to the owner', async () => {
    const { svc, prisma } = make();
    prisma.alert.findFirst.mockResolvedValue(null);
    await expect(svc.update('u', 'a', { active: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.remove('u', 'a')).rejects.toBeInstanceOf(NotFoundException);
    prisma.alert.findFirst.mockResolvedValue({ id: 'a' });
    await svc.update('u', 'a', { active: true });
    expect(prisma.alert.update.mock.calls[0][0].data).toEqual({ active: true, lastTriggeredAt: null });
    await expect(svc.update('u', 'a', {})).rejects.toThrow(/Nothing to update/);
  });

  it('lists events for the user only, flattened', async () => {
    const { svc, prisma } = make();
    prisma.alertEvent.findMany.mockResolvedValue([{ id: 'e', at: new Date(0), value: 5, message: 'm', alert: { id: 'a', widgetId: 'w', label: 'L' } }]);
    expect(await svc.events('u', 500)).toEqual([{ id: 'e', at: new Date(0), value: 5, message: 'm', alertId: 'a', widgetId: 'w', label: 'L' }]);
    expect(prisma.alertEvent.findMany.mock.calls[0][0]).toMatchObject({ where: { alert: { userId: 'u' } }, take: 100 });
  });
});
