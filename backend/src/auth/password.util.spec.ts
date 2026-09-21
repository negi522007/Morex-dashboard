import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  describe('hashPassword', () => {
    it('returns a "salt:hash" string, never the plaintext password', async () => {
      const hashed = await hashPassword('correct horse battery staple');
      expect(hashed).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
      expect(hashed).not.toContain('correct horse battery staple');
    });

    it('produces a different hash each time (random salt)', async () => {
      const a = await hashPassword('same-password');
      const b = await hashPassword('same-password');
      expect(a).not.toEqual(b);
    });
  });

  describe('verifyPassword', () => {
    it('accepts the correct password against its own hash', async () => {
      const hashed = await hashPassword('s3cr3t-pass');
      await expect(verifyPassword('s3cr3t-pass', hashed)).resolves.toBe(true);
    });

    it('rejects a wrong password', async () => {
      const hashed = await hashPassword('s3cr3t-pass');
      await expect(verifyPassword('wrong-pass', hashed)).resolves.toBe(false);
    });

    it('rejects a malformed stored value instead of throwing', async () => {
      await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toBe(false);
      await expect(verifyPassword('anything', '')).resolves.toBe(false);
    });
  });
});
