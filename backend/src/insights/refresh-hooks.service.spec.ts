import { RefreshHooksService } from './refresh-hooks.service';

function make(opts: { aiAvailable?: boolean } = {}) {
  const prisma: any = {
    widgetSnapshot: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), deleteMany: jest.fn() },
    alert: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    alertEvent: { create: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'a@b.c', language: 'fr' }) },
    widgetInstance: { update: jest.fn() },
    contentDigest: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const ai: any = {
    available: opts.aiAvailable ?? true,
    forUser: () => ({ available: true, completeJson: async (a: any) => a.mock }),
  };
  const mail: any = { sendAlertEmail: jest.fn().mockResolvedValue(undefined) };
  return { svc: new RefreshHooksService(prisma, ai, mail), prisma, mail };
}

const widget: any = { name: 'w', description: 'd', params: [], primaryMetric: (d: any) => d.v, fetchData: jest.fn() };
const inst: any = { id: 'i1', userId: 'u1', serviceName: 'svc', widgetName: 'w', config: {} };

describe('RefreshHooksService', () => {
  it('records a snapshot of the primary metric', async () => {
    const { svc, prisma } = make();
    await svc.afterRefresh(inst, widget, { v: 4.2 });
    expect(prisma.widgetSnapshot.create).toHaveBeenCalledWith({ data: { widgetId: 'i1', value: 4.2 } });
  });

  it('throttles snapshots closer than 5 minutes', async () => {
    const { svc, prisma } = make();
    prisma.widgetSnapshot.findFirst.mockResolvedValue({ at: new Date() });
    await svc.afterRefresh(inst, widget, { v: 4.2 });
    expect(prisma.widgetSnapshot.create).not.toHaveBeenCalled();
  });

  it('ignores non-numeric metrics', async () => {
    const { svc, prisma } = make();
    await svc.afterRefresh(inst, widget, { v: 'x' });
    expect(prisma.widgetSnapshot.create).not.toHaveBeenCalled();
  });

  it('fires an alert (event + localized email) when crossing the threshold', async () => {
    const { svc, prisma, mail } = make();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', operator: 'above', threshold: 10, cooldownMinutes: 60, lastTriggeredAt: null, label: 'BTC' }]);
    await svc.afterRefresh(inst, widget, { v: 11 });
    expect(prisma.alertEvent.create).toHaveBeenCalled();
    expect(mail.sendAlertEmail).toHaveBeenCalledWith('a@b.c', 'Alerte Dashboard : BTC', expect.stringContaining('au-dessus'));
  });

  it('does not re-fire during the cooldown, nor when not crossed', async () => {
    const { svc, prisma, mail } = make();
    prisma.alert.findMany.mockResolvedValue([
      { id: 'a1', operator: 'above', threshold: 10, cooldownMinutes: 60, lastTriggeredAt: new Date() },
      { id: 'a2', operator: 'below', threshold: 1, cooldownMinutes: 60, lastTriggeredAt: null },
    ]);
    await svc.afterRefresh(inst, widget, { v: 11 });
    expect(mail.sendAlertEmail).not.toHaveBeenCalled();
  });

  it('stores a generic insight only when AI is enabled on the widget', async () => {
    const { svc, prisma } = make();
    await svc.refreshInsight({ ...inst, aiEnabled: true }, widget, { v: 1 });
    expect(prisma.widgetInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ insight: expect.objectContaining({ kind: 'summary' }), insightHash: expect.any(String) }) }),
    );
  });

  it('skips the AI when the data has not changed since the last insight', async () => {
    const { svc, prisma } = make();
    await svc.refreshInsight({ ...inst, aiEnabled: true }, widget, { v: 1 });
    const hash = prisma.widgetInstance.update.mock.calls[0][0].data.insightHash;
    prisma.widgetInstance.update.mockClear();
    await svc.refreshInsight({ ...inst, aiEnabled: true, insightHash: hash }, widget, { v: 1 });
    expect(prisma.widgetInstance.update).not.toHaveBeenCalled();
  });

  it('never calls the AI path when the model is unavailable', async () => {
    const { svc, prisma } = make({ aiAvailable: false });
    await svc.afterRefresh({ ...inst, aiEnabled: true }, widget, { v: 1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(prisma.widgetInstance.update).not.toHaveBeenCalled();
  });
});
