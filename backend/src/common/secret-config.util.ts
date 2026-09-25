import { decryptToken, encryptToken } from './token-encryption.util';
import type { WidgetParam } from '../services/service-provider.interface';

// What the API returns in place of a secret param's value.
export const SECRET_MASK = '********';
const PREFIX = 'enc:v1:';

type Config = Record<string, unknown>;

const secretNames = (params: WidgetParam[]) => params.filter((p) => p.secret).map((p) => p.name);

export const isEncrypted = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIX);

// Incoming config (create/update) -> what gets stored. A secret is encrypted;
// the mask (or an omitted param on update) keeps whatever is already stored.
export function encryptSecrets(params: WidgetParam[], incoming: Config, existing: Config | null, key: string): Config {
  const out: Config = { ...incoming };
  for (const name of secretNames(params)) {
    const value = incoming[name];
    if (value === undefined || value === null || value === SECRET_MASK) {
      if (existing && existing[name] !== undefined) out[name] = existing[name];
      else delete out[name];
    } else if (value === '') {
      delete out[name];
    } else if (!isEncrypted(value)) {
      out[name] = PREFIX + encryptToken(String(value), key);
    }
  }
  return out;
}

// Stored config -> what the API may show.
export function maskSecrets(params: WidgetParam[], stored: Config): Config {
  const out: Config = { ...stored };
  for (const name of secretNames(params)) if (out[name] !== undefined) out[name] = SECRET_MASK;
  return out;
}

// Stored config -> what fetchData receives.
export function decryptSecrets(params: WidgetParam[], stored: Config, key: string): Config {
  const out: Config = { ...stored };
  for (const name of secretNames(params)) {
    if (isEncrypted(out[name])) out[name] = decryptToken((out[name] as string).slice(PREFIX.length), key);
  }
  return out;
}
