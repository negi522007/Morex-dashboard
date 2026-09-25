import { CalendarProvider } from './calendar.provider';
import { EpitechProvider } from '../epitech/epitech.provider';
import { ServiceFetchError } from '../service-provider.interface';

const soon = (h: number) => new Date(Date.now() + h * 3600_000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const ICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Exam\r\nDTSTART:${soon(5)}\r\nDTEND:${soon(6)}\r\nLOCATION:Room 2\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const ok = (text: string, url = 'https://x') => jest.fn().mockResolvedValue({ ok: true, status: 200, url, contentType: 'text/calendar', text }) as any;

describe('calendar / upcoming_events', () => {
  const p = new CalendarProvider();
  const w = p.widgets[0];

  it('declares the URL as a secret and the widget as not shareable', () => {
    expect(w.params.find((x) => x.name === 'url')).toMatchObject({ required: true, secret: true });
    expect(w.shareable).toBe(false);
  });

  it('turns webcal:// into https:// and returns parsed events', async () => {
    p.fetcher = ok(ICS);
    const r: any = await w.fetchData({ url: 'webcal://calendar.google.com/x/basic.ics' });
    expect(p.fetcher).toHaveBeenCalledWith('https://calendar.google.com/x/basic.ics', expect.anything());
    expect(r.events[0]).toMatchObject({ title: 'Exam', location: 'Room 2' });
  });

  it('never leaks the secret URL in errors', async () => {
    const url = 'https://calendar.google.com/private-abcdef/basic.ics';
    p.fetcher = jest.fn().mockRejectedValue(new Error(`boom ${url}`)) as any;
    const err: any = await w.fetchData({ url }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceFetchError);
    expect(err.message).not.toContain('private-abcdef');
  });

  it('rejects a non-calendar response and HTTP errors', async () => {
    p.fetcher = ok('<html>login</html>');
    await expect(w.fetchData({ url: 'https://a.test/x' })).rejects.toThrow(/iCalendar/);
    p.fetcher = jest.fn().mockResolvedValue({ ok: false, status: 404, text: '' }) as any;
    await expect(w.fetchData({ url: 'https://a.test/x' })).rejects.toThrow(/HTTP 404/);
  });
});

describe('epitech', () => {
  const p = new EpitechProvider();
  const planning = p.widgets.find((x) => x.name === 'planning')!;
  const profile = p.widgets.find((x) => x.name === 'profile')!;

  it('builds the calendar URL from a valid token only', async () => {
    p.fetcher = ok(ICS);
    await planning.fetchData({ calendarToken: 'abcDEF123-_.~' });
    expect(p.fetcher).toHaveBeenCalledWith('https://my.epitech.eu/api/events/calendar/abcDEF123-_.~', expect.anything());
    await expect(planning.fetchData({ calendarToken: '../../etc/passwd' })).rejects.toThrow(/malformed/);
    await expect(planning.fetchData({ calendarToken: 'short' })).rejects.toThrow(/malformed/);
  });

  it('planning is secret + private; profile needs a linked account and is served from the stored profile', async () => {
    expect(planning.params[0]).toMatchObject({ name: 'calendarToken', secret: true });
    expect(planning.shareable).toBe(false);
    expect(profile.requiresAuth).toBe(true);
    expect(await profile.fetchData({}, { profile: { login: 'a.b@epitech.eu' } })).toEqual({ login: 'a.b@epitech.eu' });
    await expect(profile.fetchData({})).rejects.toBeInstanceOf(ServiceFetchError);
  });
});
