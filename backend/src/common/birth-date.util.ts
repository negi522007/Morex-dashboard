import { BadRequestException } from '@nestjs/common';

export const ZODIAC_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
export type Zodiac = (typeof ZODIAC_SIGNS)[number];

export const MIN_AGE = 13;

// Days on which each sign starts (month, day), in calendar order from Capricorn's second half.
const STARTS: [number, number, Zodiac][] = [
  [1, 20, 'aquarius'], [2, 19, 'pisces'], [3, 21, 'aries'], [4, 20, 'taurus'], [5, 21, 'gemini'], [6, 21, 'cancer'],
  [7, 23, 'leo'], [8, 23, 'virgo'], [9, 23, 'libra'], [10, 23, 'scorpio'], [11, 22, 'sagittarius'], [12, 22, 'capricorn'],
];

export function zodiacOf(date: Date): Zodiac {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  let sign: Zodiac = 'capricorn'; // Jan 1–19
  for (const [sm, sd, name] of STARTS) if (m > sm || (m === sm && d >= sd)) sign = name;
  return sign;
}

export const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

// "YYYY-MM-DD" → a Date at UTC midnight (what a Postgres DATE column round-trips as). Throws a 400 on
// anything that is not a real, past date of someone at least MIN_AGE years old.
export function parseBirthDate(raw: unknown, now = new Date()): Date {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) throw new BadRequestException('birthDate must look like YYYY-MM-DD');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new BadRequestException('birthDate is not a real calendar date');
  }
  if (y < 1900 || date.getTime() > now.getTime()) throw new BadRequestException('birthDate is out of range');
  const cutoff = Date.UTC(now.getUTCFullYear() - MIN_AGE, now.getUTCMonth(), now.getUTCDate());
  if (date.getTime() > cutoff) throw new BadRequestException(`You must be at least ${MIN_AGE} years old to create an account`);
  return date;
}
