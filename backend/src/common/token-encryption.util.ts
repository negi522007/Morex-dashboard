import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

// Stored as "iv:authTag:ciphertext" (all hex) — a self-contained payload,
// no separate column needed for the IV/tag. Key must be 32 bytes (64 hex
// chars), e.g. generated with `openssl rand -hex 32`.
export function encryptToken(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString('hex')).join(':');
}

export function decryptToken(payload: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
