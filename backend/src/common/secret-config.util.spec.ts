import { SECRET_MASK, decryptSecrets, encryptSecrets, isEncrypted, maskSecrets } from './secret-config.util';

const KEY = 'a'.repeat(64);
const params = [
  { name: 'url', type: 'string' as const, required: true, secret: true },
  { name: 'number', type: 'integer' as const },
];

describe('secret config', () => {
  it('encrypts a secret param and leaves the others alone', () => {
    const stored = encryptSecrets(params, { url: 'https://cal.example/private?token=abc', number: 5 }, null, KEY);
    expect(isEncrypted(stored.url)).toBe(true);
    expect(String(stored.url)).not.toContain('private');
    expect(stored.number).toBe(5);
  });

  it('round-trips through decrypt', () => {
    const stored = encryptSecrets(params, { url: 'https://cal.example/x' }, null, KEY);
    expect(decryptSecrets(params, stored, KEY).url).toBe('https://cal.example/x');
  });

  it('masks secrets in what the API returns, never the ciphertext', () => {
    const stored = encryptSecrets(params, { url: 'https://cal.example/x', number: 3 }, null, KEY);
    expect(maskSecrets(params, stored)).toEqual({ url: SECRET_MASK, number: 3 });
  });

  it('keeps the stored secret when the mask is sent back or the param is omitted', () => {
    const stored = encryptSecrets(params, { url: 'https://cal.example/x' }, null, KEY);
    expect(encryptSecrets(params, { url: SECRET_MASK, number: 9 }, stored, KEY).url).toBe(stored.url);
    expect(encryptSecrets(params, { number: 9 }, stored, KEY).url).toBe(stored.url);
  });

  it('replaces the secret when a new value is sent, and removes it when emptied', () => {
    const stored = encryptSecrets(params, { url: 'https://old' }, null, KEY);
    const replaced = encryptSecrets(params, { url: 'https://new' }, stored, KEY);
    expect(decryptSecrets(params, replaced, KEY).url).toBe('https://new');
    expect(encryptSecrets(params, { url: '' }, stored, KEY).url).toBeUndefined();
  });

  it('does not double-encrypt an already-encrypted value', () => {
    const stored = encryptSecrets(params, { url: 'https://x' }, null, KEY);
    expect(encryptSecrets(params, { url: stored.url }, stored, KEY).url).toBe(stored.url);
  });
});
