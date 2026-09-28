import { ExportService } from './export.service';

describe('ExportService', () => {
  const user = {
    id: 'u1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', birthDate: new Date('2000-05-10'), bio: 'Hi',
    language: 'fr', theme: 'aurora', widgetSkin: 'glass', avatarConfig: { hair: 'long' }, avatarPhotoPath: null,
    passwordHash: 'salt:SECRET-HASH', createdAt: new Date('2026-09-01'),
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    alert: { findMany: jest.fn().mockResolvedValue([{ widgetId: 'w1', label: 'BTC', operator: 'above', threshold: 80000, cooldownMinutes: 60, active: true, createdAt: new Date(), events: [{ at: new Date(), value: 84000, message: 'BTC above' }] }]) },
    oAuthAccount: { findMany: jest.fn().mockResolvedValue([{ provider: 'github', profile: null }]) },
  };
  const widgets = { list: jest.fn().mockResolvedValue([{ id: 'w1', serviceName: 'calendar', widgetName: 'upcoming_events', config: { url: '********', days: 7 }, cachedData: { big: 'third-party data' }, refreshRateSeconds: 300, createdAt: new Date() }]) };
  const journal = { list: jest.fn().mockResolvedValue([{ id: 'j1', date: new Date(), mood: '😊', text: 'Dear journal', createdAt: new Date(), updatedAt: new Date() }]) };
  const svc = new ExportService(prisma as any, widgets as any, journal as any);

  it('exports the profile, widgets, journal, alerts and linked accounts', async () => {
    const out = await svc.exportFor('u1');
    expect(out.profile).toMatchObject({ email: 'ada@example.com', firstName: 'Ada', birthDate: '2000-05-10', hasPassword: true });
    expect(out.widgets[0]).toMatchObject({ service: 'calendar', config: { url: '********', days: 7 } });
    expect(out.journal?.[0].text).toBe('Dear journal');
    expect(out.alerts[0].events[0].value).toBe(84000);
    expect(out.linkedAccounts).toEqual([{ provider: 'github', profile: null }]);
  });

  it('never lets a secret or fetched third-party data out', async () => {
    const text = JSON.stringify(await svc.exportFor('u1'));
    expect(text).not.toContain('SECRET-HASH');
    expect(text).not.toContain('passwordHash');
    expect(text).not.toContain('accessToken');
    expect(text).not.toContain('third-party data');
  });
});
