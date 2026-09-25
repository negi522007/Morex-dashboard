import { parseIcs } from './ics.util';

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
const window = (from: string, to: string) => ({ from: new Date(from), to: new Date(to) });

describe('parseIcs', () => {
  it('reads UTC events, unescapes text and unfolds long lines', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Sprint\\, review\r\n  part two\r\nDTSTART:20260926T090000Z\r\nDTEND:20260926T100000Z\r\nLOCATION:Room 4\; B\r\nEND:VEVENT');
    expect(parseIcs(ics, window('2026-09-25T00:00:00Z', '2026-10-05T00:00:00Z'))).toEqual([
      { title: 'Sprint, review part two', start: '2026-09-26T09:00:00.000Z', end: '2026-09-26T10:00:00.000Z', allDay: false, location: 'Room 4; B' },
    ]);
  });

  it('converts TZID events to the right instant (with DST)', () => {
    const ev = (d: string) => wrap(`BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Paris\r\nDTSTART;TZID=Europe/Paris:${d}T090000\r\nEND:VEVENT`);
    const w = window('2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z');
    expect(parseIcs(ev('20260115'), w)[0].start).toBe('2026-01-15T08:00:00.000Z'); // CET, UTC+1
    expect(parseIcs(ev('20260715'), w)[0].start).toBe('2026-07-15T07:00:00.000Z'); // CEST, UTC+2
  });

  it('treats date-only events as all-day, and unknown zones as UTC', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261001\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Odd\r\nDTSTART;TZID=W. Europe Standard Time:20261002T100000\r\nEND:VEVENT');
    const r = parseIcs(ics, window('2026-09-30T00:00:00Z', '2026-10-10T00:00:00Z'));
    expect(r[0]).toMatchObject({ title: 'Holiday', allDay: true, start: '2026-10-01T00:00:00.000Z' });
    expect(r[1].start).toBe('2026-10-02T10:00:00.000Z');
  });

  it('expands weekly BYDAY rules with COUNT and skips EXDATE', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Class\r\nDTSTART:20260907T080000Z\r\nDTEND:20260907T100000Z\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6\r\nEXDATE:20260909T080000Z\r\nEND:VEVENT');
    const r = parseIcs(ics, window('2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z'));
    // Mon 7, (Wed 9 excluded), Mon 14, Wed 16, Mon 21, Wed 23 → 5 remain of 6
    expect(r.map((e) => e.start.slice(0, 10))).toEqual(['2026-09-07', '2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23']);
    expect(r[1].end).toBe('2026-09-14T10:00:00.000Z');
  });

  it('expands daily/monthly/yearly rules inside the window only, honouring UNTIL', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Daily\r\nDTSTART:20260101T070000Z\r\nRRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261231T000000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Rent\r\nDTSTART:20250115T000000Z\r\nRRULE:FREQ=MONTHLY\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:3\r\nSUMMARY:Birthday\r\nDTSTART;VALUE=DATE:20000928\r\nRRULE:FREQ=YEARLY\r\nEND:VEVENT');
    const r = parseIcs(ics, window('2026-09-25T00:00:00Z', '2026-10-01T00:00:00Z'));
    expect(r.filter((e) => e.title === 'Daily').map((e) => e.start.slice(5, 10))).toEqual(['09-26', '09-28', '09-30']);
    expect(r.filter((e) => e.title === 'Rent')).toHaveLength(0);
    expect(r.filter((e) => e.title === 'Birthday').map((e) => e.start.slice(0, 10))).toEqual(['2026-09-28']);
  });

  it('applies RECURRENCE-ID overrides without duplicating the original', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Standup\r\nDTSTART:20260928T090000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Standup (moved)\r\nRECURRENCE-ID:20260929T090000Z\r\nDTSTART:20260929T140000Z\r\nEND:VEVENT');
    const r = parseIcs(ics, window('2026-09-27T00:00:00Z', '2026-10-05T00:00:00Z'));
    expect(r.map((e) => `${e.title}@${e.start.slice(5, 16)}`)).toEqual([
      'Standup@09-28T09:00', 'Standup (moved)@09-29T14:00', 'Standup@09-30T09:00',
    ]);
  });

  it('drops cancelled events, past events and respects the limit; tolerates garbage', () => {
    const ics = wrap('BEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Gone\r\nSTATUS:CANCELLED\r\nDTSTART:20260926T090000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:2\r\nSUMMARY:Old\r\nDTSTART:20200101T090000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:3\r\nSUMMARY:A\r\nDTSTART:20260927T090000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:4\r\nSUMMARY:B\r\nDTSTART:20260928T090000Z\r\nEND:VEVENT');
    const r = parseIcs(ics, { ...window('2026-09-25T00:00:00Z', '2026-10-05T00:00:00Z'), limit: 1 });
    expect(r.map((e) => e.title)).toEqual(['A']);
    expect(parseIcs('not a calendar', window('2026-09-25T00:00:00Z', '2026-10-05T00:00:00Z'))).toEqual([]);
  });
});
