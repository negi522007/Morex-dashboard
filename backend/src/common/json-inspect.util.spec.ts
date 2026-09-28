import { fieldsOfItem, inspectJson } from './json-inspect.util';

describe('inspectJson', () => {
  it('lists scalar leaf paths for an object, nested ones included', () => {
    const r = inspectJson({ a: 1, b: { c: 'x', d: { e: true } }, f: null });
    expect(r.root).toBe('object');
    expect(r.values.map((v) => v.path).sort()).toEqual(['a', 'b.c', 'b.d.e', 'f']);
    expect(r.values.find((v) => v.path === 'a')?.sample).toBe('1');
  });

  it('finds arrays of objects anywhere and their item fields, but does not descend into array items for scalar values', () => {
    const r = inspectJson({ data: { items: [{ price: 5, name: 'x' }, { price: 6, name: 'y' }] } });
    expect(r.lists).toEqual([{ path: 'data.items', label: 'data.items', fields: [{ path: 'price', label: 'price', sample: '5' }, { path: 'name', label: 'name', sample: 'x' }] }]);
    expect(r.values.map((v) => v.path)).not.toContain('data.items.0.price');
  });

  it('handles a root-level array (path "") and a root-level scalar', () => {
    const arr = inspectJson([{ a: 1 }, { a: 2 }]);
    expect(arr.root).toBe('array');
    expect(arr.lists).toEqual([{ path: '', label: '(the response itself)', fields: [{ path: 'a', label: 'a', sample: '1' }] }]);

    const scalar = inspectJson(42);
    expect(scalar).toEqual({ root: 'scalar', values: [{ path: '', label: '(the response itself)', sample: '42' }], lists: [] });
  });

  it('skips arrays of arrays and arrays of scalars (nothing sensible to pick as titleField)', () => {
    const r = inspectJson({ a: [[1, 2], [3, 4]], b: [1, 2, 3] });
    expect(r.lists).toEqual([]);
  });

  it('caps depth and the number of values/lists so a huge or adversarial document stays cheap', () => {
    let deep: any = { v: 1 };
    for (let i = 0; i < 20; i++) deep = { n: deep };
    expect(inspectJson(deep).values).toEqual([]);

    const wide: Record<string, number> = {};
    for (let i = 0; i < 200; i++) wide[`k${i}`] = i;
    expect(inspectJson(wide).values.length).toBeLessThanOrEqual(30);

    const manyLists: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) manyLists[`l${i}`] = [{ x: 1 }];
    expect(inspectJson(manyLists).lists.length).toBeLessThanOrEqual(12);
  });
});

describe('fieldsOfItem', () => {
  it('returns only scalar fields, capped, and empty for non-objects', () => {
    expect(fieldsOfItem({ a: 1, nested: { b: 2 }, list: [1] })).toEqual([{ path: 'a', label: 'a', sample: '1' }]);
    expect(fieldsOfItem(null)).toEqual([]);
    expect(fieldsOfItem([1, 2])).toEqual([]);
  });
});
