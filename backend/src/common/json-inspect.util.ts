import { clip } from '../ai/ai.service';

// Flattens a fetched JSON document into candidate paths for the custom_api widgets' form: which
// scalar values could feed "json_value", and which arrays-of-objects could feed "json_list" (with
// their own item fields, for "titleField"/"subtitleField"). Read-only, no mutation, no code execution.

export interface ValuePath {
  path: string;
  label: string;
  sample: string;
}
export interface ListPath {
  path: string;
  label: string;
  fields: ValuePath[];
}
export interface Inspection {
  root: 'object' | 'array' | 'scalar';
  values: ValuePath[];
  lists: ListPath[];
}

const MAX_DEPTH = 4;
const MAX_VALUES = 30;
const MAX_LISTS = 12;
const MAX_FIELDS = 20;

const sampleOf = (v: unknown): string => (v === null ? 'null' : typeof v === 'object' ? '' : clip(String(v), 60));

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// The scalar (and only scalar) fields of one list item — what "titleField"/"subtitleField" can point to.
export function fieldsOfItem(item: unknown): ValuePath[] {
  if (!isPlainObject(item)) return [];
  const out: ValuePath[] = [];
  for (const [k, v] of Object.entries(item)) {
    if (v === null || typeof v !== 'object') out.push({ path: k, label: k, sample: sampleOf(v) });
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}

export function inspectJson(root: unknown): Inspection {
  if (!isPlainObject(root) && !Array.isArray(root)) {
    return { root: 'scalar', values: [{ path: '', label: '(the response itself)', sample: sampleOf(root) }], lists: [] };
  }
  const values: ValuePath[] = [];
  const lists: ListPath[] = [];

  const visitArray = (arr: unknown[], path: string) => {
    if (lists.length >= MAX_LISTS) return;
    if (arr.length && isPlainObject(arr[0])) {
      lists.push({ path, label: path || '(the response itself)', fields: fieldsOfItem(arr[0]) });
    }
    // Items are not walked further: a list's own fields come from fieldsOfItem, not from `values`.
  };

  const walk = (node: unknown, path: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    if (Array.isArray(node)) {
      visitArray(node, path);
      return;
    }
    if (!isPlainObject(node)) return;
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (v === null || typeof v !== 'object') {
        if (values.length < MAX_VALUES) values.push({ path: p, label: p, sample: sampleOf(v) });
      } else if (Array.isArray(v)) {
        visitArray(v, p);
      } else {
        walk(v, p, depth + 1);
      }
    }
  };

  if (Array.isArray(root)) visitArray(root, '');
  else walk(root, '', 0);
  return { root: Array.isArray(root) ? 'array' : 'object', values, lists };
}
