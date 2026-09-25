import { getPath } from './json-path.util';

describe('getPath', () => {
  const data = { a: { b: [{ c: 1 }, { c: 2 }] }, 'x y': 3, n: null };
  it('walks objects and arrays in both syntaxes', () => {
    expect(getPath(data, 'a.b[1].c')).toBe(2);
    expect(getPath(data, 'a.b.0.c')).toBe(1);
    expect(getPath(data, '')).toBe(data);
  });
  it('returns undefined for missing paths and null hops', () => {
    expect(getPath(data, 'a.z')).toBeUndefined();
    expect(getPath(data, 'n.x')).toBeUndefined();
    expect(getPath(data, 'a.b[9].c')).toBeUndefined();
  });
  it('refuses prototype access', () => {
    expect(getPath(data, '__proto__')).toBeUndefined();
    expect(getPath(data, 'a.constructor')).toBeUndefined();
  });
});
