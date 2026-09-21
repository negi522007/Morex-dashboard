import { decryptToken, encryptToken } from './token-encryption.util';

const KEY_A = 'a'.repeat(64); // 32 bytes hex
const KEY_B = 'b'.repeat(64);

describe('token-encryption.util', () => {
  it('round-trips a plaintext token through the same key', () => {
    const encrypted = encryptToken('gho_realGitHubToken123', KEY_A);
    expect(encrypted).not.toContain('gho_realGitHubToken123');
    expect(decryptToken(encrypted, KEY_A)).toBe('gho_realGitHubToken123');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const first = encryptToken('same-token', KEY_A);
    const second = encryptToken('same-token', KEY_A);
    expect(first).not.toEqual(second);
  });

  it('fails to decrypt with the wrong key (auth tag mismatch)', () => {
    const encrypted = encryptToken('gho_realGitHubToken123', KEY_A);
    expect(() => decryptToken(encrypted, KEY_B)).toThrow();
  });

  it('fails to decrypt a tampered payload', () => {
    const encrypted = encryptToken('gho_realGitHubToken123', KEY_A);
    const [iv, tag, data] = encrypted.split(':');
    const tampered = [iv, tag, data.slice(0, -2) + '00'].join(':');
    expect(() => decryptToken(tampered, KEY_A)).toThrow();
  });
});
