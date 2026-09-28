import { BadRequestException } from '@nestjs/common';
import { parseBirthDate, toIsoDate, zodiacOf } from './birth-date.util';

const NOW = new Date('2026-09-26T12:00:00Z');
const sign = (s: string) => zodiacOf(new Date(`${s}T00:00:00Z`));

describe('zodiacOf', () => {
  it('handles the boundary days of every sign', () => {
    const cases: [string, string][] = [
      ['2000-03-20', 'pisces'], ['2000-03-21', 'aries'], ['2000-04-19', 'aries'], ['2000-04-20', 'taurus'], ['2000-05-20', 'taurus'],
      ['2000-05-21', 'gemini'], ['2000-06-20', 'gemini'], ['2000-06-21', 'cancer'], ['2000-07-22', 'cancer'], ['2000-07-23', 'leo'],
      ['2000-08-22', 'leo'], ['2000-08-23', 'virgo'], ['2000-09-22', 'virgo'], ['2000-09-23', 'libra'], ['2000-10-22', 'libra'],
      ['2000-10-23', 'scorpio'], ['2000-11-21', 'scorpio'], ['2000-11-22', 'sagittarius'], ['2000-12-21', 'sagittarius'],
      ['2000-12-22', 'capricorn'], ['2000-12-31', 'capricorn'], ['2000-01-01', 'capricorn'], ['2000-01-19', 'capricorn'],
      ['2000-01-20', 'aquarius'], ['2000-02-18', 'aquarius'], ['2000-02-19', 'pisces'], ['2000-02-29', 'pisces'],
    ];
    for (const [d, s] of cases) expect([d, sign(d)]).toEqual([d, s]);
  });
});

describe('parseBirthDate', () => {
  it('accepts a real date and round-trips it', () => {
    expect(toIsoDate(parseBirthDate('2001-02-28', NOW))).toBe('2001-02-28');
    expect(toIsoDate(parseBirthDate(' 2000-02-29 ', NOW))).toBe('2000-02-29');
  });
  it.each(['', 'yesterday', '2001-2-3', '2001-13-01', '2001-02-30', '2023-02-29', '1899-12-31', '2999-01-01', 20010203, null, undefined])(
    'rejects %p', (v) => {
      expect(() => parseBirthDate(v as any, NOW)).toThrow(BadRequestException);
    },
  );
  it('requires a minimum age of 13, to the day', () => {
    expect(() => parseBirthDate('2013-09-27', NOW)).toThrow(/at least 13/);
    expect(toIsoDate(parseBirthDate('2013-09-26', NOW))).toBe('2013-09-26');
  });
});
