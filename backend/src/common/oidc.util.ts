import { BadRequestException } from '@nestjs/common';
import { createHash, createPublicKey, randomBytes, verify as cryptoVerify } from 'node:crypto';

// Building blocks shared by the OpenID Connect sign-ins (My Epitech, Microsoft): PKCE values and the
// checks on the provider's signed id_token. Written on node:crypto, no extra dependency.

export const b64url = (buf: Buffer) => buf.toString('base64url');

// The values the callback must present again: state (CSRF), nonce (token replay), PKCE verifier + challenge.
export function newPkce() {
  const verifier = b64url(randomBytes(32));
  return {
    state: randomBytes(16).toString('hex'),
    nonce: randomBytes(16).toString('hex'),
    verifier,
    challenge: b64url(createHash('sha256').update(verifier).digest()),
  };
}

const CLOCK_SKEW_S = 120;

export interface IdTokenChecks {
  // A RegExp is for a multi-tenant provider whose real per-token issuer varies (e.g. Microsoft's
  // "common" endpoint, one real tenant GUID per organisation) and can't be pinned to one fixed string
  // the way a single-tenant provider's discovery document can.
  issuer: string | RegExp;
  audience: string;
  nonce: string;
}

// RS256 signature against the provider's published keys, then iss / aud / exp / nonce. Returns the claims.
// `onUnknownKey` lets the caller drop its key cache (keys may have rotated).
export function verifyIdToken(idToken: string, keys: any[], checks: IdTokenChecks, onUnknownKey?: () => void): Record<string, any> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new BadRequestException('Invalid identity token');
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    throw new BadRequestException('Invalid identity token');
  }
  if (header.alg !== 'RS256') throw new BadRequestException('Unsupported identity token algorithm');

  const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) {
    onUnknownKey?.();
    throw new BadRequestException('Unknown identity token signing key');
  }
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new BadRequestException('Invalid identity token signature');

  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const issuerOk = typeof checks.issuer === 'string' ? payload.iss === checks.issuer : checks.issuer.test(payload.iss);
  if (!issuerOk) throw new BadRequestException('Identity token issuer mismatch');
  if (!aud.includes(checks.audience)) throw new BadRequestException('Identity token audience mismatch');
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < now) throw new BadRequestException('Identity token expired');
  if (payload.nonce !== checks.nonce) throw new BadRequestException('Identity token nonce mismatch');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new BadRequestException('Identity token has no subject');
  return payload;
}
