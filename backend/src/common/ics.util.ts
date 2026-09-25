// A small iCalendar (RFC 5545) reader: enough for Google Calendar's "secret
// address in iCal format" and My Epitech's planning feed. It expands the
// common recurrence rules; exotic ones (BYSETPOS, ordinal BYDAY, RDATE) and
// Windows time-zone names are not supported — those events fall back to UTC.

export interface IcsEvent {
  title: string;
  start: string; // ISO instant (all-day: midnight UTC of that date)
  end: string | null;
  allDay: boolean;
  location: string | null;
}

interface Wall {
  y: number;
  mo: number; // 1-12
  d: number;
  h: number;
  mi: number;
  s: number;
}
interface When {
  wall: Wall;
  tz: string | null; // null = UTC / floating
  allDay: boolean;
}

const dtfCache = new Map<string, Intl.DateTimeFormat | null>();

function formatter(tz: string): Intl.DateTimeFormat | null {
  if (!dtfCache.has(tz)) {
    try {
      dtfCache.set(
        tz,
        new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        }),
      );
    } catch {
      dtfCache.set(tz, null);
    }
  }
  return dtfCache.get(tz) ?? null;
}

function tzOffsetMs(tz: string, utcMs: number): number {
  const f = formatter(tz);
  if (!f) return 0;
  const p: Record<string, number> = {};
  for (const part of f.formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function wallToMs(w: Wall, tz: string | null): number {
  const naive = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  if (!tz || !formatter(tz)) return naive;
  let guess = naive - tzOffsetMs(tz, naive);
  guess = naive - tzOffsetMs(tz, guess);
  return guess;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  // The value starts at the first ':' that is not inside a quoted parameter.
  let inQuote = false;
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    else if (line[i] === ':' && !inQuote) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return null;
  const [name, ...rawParams] = line.slice(0, idx).split(';');
  const params: Record<string, string> = {};
  for (const rp of rawParams) {
    const eq = rp.indexOf('=');
    if (eq > 0) params[rp.slice(0, eq).toUpperCase()] = rp.slice(eq + 1).replace(/"/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(idx + 1) };
}

function parseWhen(p: Prop): When | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim());
  if (!m) return null;
  const wall: Wall = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
  const allDay = p.params.VALUE === 'DATE' || m[4] === undefined;
  const tz = m[7] || allDay ? null : p.params.TZID ?? null;
  return { wall, tz, allDay };
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: number | null;
  byday: number[] | null;
}

function parseRule(value: string): Rule | null {
  const kv: Record<string, string> = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) kv[k.toUpperCase()] = v;
  }
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(kv.FREQ)) return null;
  const until = kv.UNTIL ? parseWhen({ name: 'UNTIL', params: {}, value: kv.UNTIL }) : null;
  const byday = kv.BYDAY
    ? kv.BYDAY.split(',').map((d) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, '').toUpperCase())).filter((i) => i >= 0)
    : null;
  return {
    freq: kv.FREQ as Rule['freq'],
    interval: Math.max(1, Number(kv.INTERVAL) || 1),
    count: kv.COUNT ? Number(kv.COUNT) : null,
    until: until ? wallToMs(until.wall, until.tz) + (until.allDay ? 86_400_000 - 1 : 0) : null,
    byday: byday && byday.length ? byday : null,
  };
}

const DAY_MS = 86_400_000;
const MAX_DAYS_SCANNED = 20_000;

// Wall-clock dates (not instants) at which a recurring event starts, up to `limitMs`.
function* occurrences(start: When, rule: Rule, limitMs: number): Generator<Wall> {
  const first = Date.UTC(start.wall.y, start.wall.mo - 1, start.wall.d);
  const startDow = new Date(first).getUTCDay();
  const mondayOf = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;
  const firstWeek = mondayOf(first);
  let emitted = 0;

  for (let i = 0; i < MAX_DAYS_SCANNED; i++) {
    const dayMs = first + i * DAY_MS;
    const dt = new Date(dayMs);
    let hit = false;
    switch (rule.freq) {
      case 'DAILY':
        hit = i % rule.interval === 0;
        break;
      case 'WEEKLY': {
        const weeks = Math.round((mondayOf(dayMs) - firstWeek) / (7 * DAY_MS));
        hit = weeks % rule.interval === 0 && (rule.byday ?? [startDow]).includes(dt.getUTCDay());
        break;
      }
      case 'MONTHLY': {
        const months = (dt.getUTCFullYear() - start.wall.y) * 12 + dt.getUTCMonth() + 1 - start.wall.mo;
        hit = dt.getUTCDate() === start.wall.d && months % rule.interval === 0;
        break;
      }
      case 'YEARLY':
        hit = dt.getUTCDate() === start.wall.d && dt.getUTCMonth() + 1 === start.wall.mo && (dt.getUTCFullYear() - start.wall.y) % rule.interval === 0;
        break;
    }
    if (!hit) {
      if (dayMs > limitMs + 2 * DAY_MS) return;
      continue;
    }
    const wall: Wall = { ...start.wall, y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const ms = wallToMs(wall, start.tz);
    if (rule.until !== null && ms > rule.until) return;
    emitted++;
    yield wall;
    if (rule.count !== null && emitted >= rule.count) return;
    if (ms > limitMs) return;
  }
}

interface RawEvent {
  uid: string;
  title: string;
  location: string | null;
  start: When;
  end: When | null;
  rule: Rule | null;
  exdates: Set<number>;
  recurrenceId: number | null;
}

function readEvents(text: string): RawEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: RawEvent[] = [];
  let cur: (Partial<RawEvent> & { exdates: Set<number>; cancelled?: boolean }) | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { exdates: new Set() };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur?.start && !cur.cancelled) {
        events.push({
          uid: cur.uid ?? '', title: cur.title ?? '', location: cur.location ?? null, start: cur.start,
          end: cur.end ?? null, rule: cur.rule ?? null, exdates: cur.exdates, recurrenceId: cur.recurrenceId ?? null,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    switch (p.name) {
      case 'UID': cur.uid = p.value; break;
      case 'SUMMARY': cur.title = unescapeText(p.value); break;
      case 'LOCATION': cur.location = unescapeText(p.value) || null; break;
      case 'DTSTART': cur.start = parseWhen(p) ?? undefined; break;
      case 'DTEND': cur.end = parseWhen(p); break;
      case 'RRULE': cur.rule = parseRule(p.value); break;
      case 'EXDATE':
        for (const v of p.value.split(',')) {
          const w = parseWhen({ ...p, value: v });
          if (w) cur.exdates.add(wallToMs(w.wall, w.tz));
        }
        break;
      case 'RECURRENCE-ID': {
        const w = parseWhen(p);
        if (w) cur.recurrenceId = wallToMs(w.wall, w.tz);
        break;
      }
      case 'STATUS':
        if (p.value.toUpperCase() === 'CANCELLED') cur.cancelled = true;
        break;
    }
  }
  return events;
}

export function parseIcs(text: string, opts: { from: Date; to: Date; limit?: number }): IcsEvent[] {
  const raw = readEvents(text);
  const overridden = new Set(raw.filter((e) => e.recurrenceId !== null).map((e) => `${e.uid}|${e.recurrenceId}`));
  const out: (IcsEvent & { ms: number })[] = [];
  const fromMs = opts.from.getTime();
  const toMs = opts.to.getTime();

  const push = (e: RawEvent, startMs: number, endMs: number | null) => {
    if ((endMs ?? startMs) < fromMs || startMs > toMs) return;
    out.push({
      ms: startMs,
      title: e.title || '(untitled)',
      start: new Date(startMs).toISOString(),
      end: endMs !== null ? new Date(endMs).toISOString() : null,
      allDay: e.start.allDay,
      location: e.location,
    });
  };

  for (const e of raw) {
    const startMs = wallToMs(e.start.wall, e.start.tz);
    const endMs = e.end ? wallToMs(e.end.wall, e.end.tz) : e.start.allDay ? startMs + DAY_MS : null;
    const duration = endMs !== null ? endMs - startMs : null;

    if (!e.rule) {
      push(e, startMs, endMs);
      continue;
    }
    for (const wall of occurrences(e.start, e.rule, toMs)) {
      const occ = wallToMs(wall, e.start.tz);
      if (e.exdates.has(occ) || overridden.has(`${e.uid}|${occ}`)) continue;
      push(e, occ, duration !== null ? occ + duration : null);
    }
  }

  out.sort((a, b) => a.ms - b.ms);
  return out.slice(0, opts.limit ?? 50).map(({ ms: _ms, ...ev }) => ev);
}
