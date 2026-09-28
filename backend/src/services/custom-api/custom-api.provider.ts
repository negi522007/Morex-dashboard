import { Injectable } from '@nestjs/common';
import { safeFetch, type SafeResponse } from '../../common/safe-fetch.util';
import { getPath } from '../../common/json-path.util';
import { clip } from '../../ai/ai.service';
import { ServiceFetchError, ServiceProvider, WidgetDefinition } from '../service-provider.interface';

export type Fetcher = (url: string, opts?: { timeoutMs?: number; maxBytes?: number }) => Promise<SafeResponse>;

const MAX_BYTES = 1_000_000;

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return '';
  return typeof v === 'object' ? clip(JSON.stringify(v), 200) : clip(String(v), 200);
}

// Public JSON APIs only: no auth headers are ever sent. The URL may still
// carry a key in its query string, hence it is a secret param.
@Injectable()
export class CustomApiProvider implements ServiceProvider {
  name = 'custom_api';
  requiresAuth = false;
  fetcher: Fetcher = safeFetch;
  widgets: WidgetDefinition[];

  constructor() {
    this.widgets = [
      {
        name: 'json_value',
        description: 'Show one value from any public JSON API (URL + path such as data.items[0].price)',
        params: [
          { name: 'url', type: 'string', required: true, secret: true },
          // Optional: empty means "the response itself is the value" (e.g. an API that just answers 42).
          { name: 'path', type: 'string' },
          { name: 'label', type: 'string' },
          { name: 'unit', type: 'string' },
        ],
        primaryMetric: (d) => asNumber((d as { value?: unknown })?.value),
        fetchData: async (config) => {
          const json = await this.load(config, 'json_value');
          const value = getPath(json, String(config.path ?? ''));
          if (value === undefined) throw new ServiceFetchError('custom_api', 'json_value', `Path "${config.path}" not found in the response`);
          return {
            label: config.label ? String(config.label) : String(config.path ?? '') || 'value',
            unit: config.unit ? String(config.unit) : null,
            value: typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? value : scalar(value),
            fetchedAt: new Date().toISOString(),
          };
        },
      },
      {
        name: 'json_list',
        description: 'Show a list from any public JSON API (path to an array + which fields to display)',
        params: [
          { name: 'url', type: 'string', required: true, secret: true },
          // Optional: empty means "the response itself is the list" (an answer that starts with [ ).
          { name: 'path', type: 'string' },
          { name: 'titleField', type: 'string', required: true },
          { name: 'subtitleField', type: 'string' },
          { name: 'number', type: 'integer' },
        ],
        fetchData: async (config) => {
          const json = await this.load(config, 'json_list');
          const list = getPath(json, String(config.path ?? ''));
          if (!Array.isArray(list)) throw new ServiceFetchError('custom_api', 'json_list', config.path ? `Path "${config.path}" is not a list in the response` : 'The response is not a list: set "path" to where the list is');
          const n = Number(config.number);
          const limit = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 30) : 8;
          const items = list.slice(0, limit).map((row) => ({
            title: scalar(getPath(row, String(config.titleField))),
            subtitle: config.subtitleField ? scalar(getPath(row, String(config.subtitleField))) : null,
          }));
          return { items, fetchedAt: new Date().toISOString() };
        },
      },
    ];
  }

  private async load(config: Record<string, string | number>, widget: string): Promise<unknown> {
    const url = String(config.url ?? '').trim();
    if (!url) throw new ServiceFetchError('custom_api', widget, 'Missing required "url" parameter');
    let res: SafeResponse;
    try {
      res = await this.fetcher(url, { timeoutMs: 10_000, maxBytes: MAX_BYTES });
    } catch (err) {
      throw new ServiceFetchError('custom_api', widget, `Could not reach the API: ${(err as Error).message.split(url).join('[url]')}`);
    }
    if (!res.ok) throw new ServiceFetchError('custom_api', widget, `The API returned HTTP ${res.status}`);
    try {
      return JSON.parse(res.text);
    } catch {
      throw new ServiceFetchError('custom_api', widget, 'The response is not valid JSON');
    }
  }
}
