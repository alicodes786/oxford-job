import { getSessionSecret } from '@/lib/auth-session';

export { sessionCookieMaxAgeSec } from '@/lib/auth-session';

/** HTTP-only cookie for cleaner portal — separate from staff dashboard cookie. */
export const CLEANER_SESSION_COOKIE = 'oxford_cleaner_session';

export type CleanerPayloadV1 = {
  v: 1;
  typ: 'cleaner';
  /** cleaners.id (uuid) */
  cid: string;
  exp: number;
};

const te = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlToBytes(s: string): Uint8Array | null {
  try {
    const padded = s + '=='.slice(0, (4 - (s.length % 4)) % 4);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ab = te.encode(a);
  const bb = te.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    te.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function sealCleanerSession(cleanerId: string, expMs: number): Promise<string> {
  const secret = getSessionSecret();
  const payload: CleanerPayloadV1 = {
    v: 1,
    typ: 'cleaner',
    cid: cleanerId,
    exp: expMs,
  };
  const payloadB64 = bytesToBase64Url(te.encode(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function unsealCleanerSession(
  token: string | undefined,
): Promise<{ cleanerId: string } | null> {
  if (!token || typeof token !== 'string') return null;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return null;

  const expected = await hmacSha256Base64Url(secret, payloadB64);
  if (!timingSafeEqualUtf8(sig, expected)) {
    return null;
  }

  const bytes = base64UrlToBytes(payloadB64);
  if (!bytes) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as CleanerPayloadV1).v !== 1 ||
    (parsed as CleanerPayloadV1).typ !== 'cleaner' ||
    typeof (parsed as CleanerPayloadV1).cid !== 'string' ||
    typeof (parsed as CleanerPayloadV1).exp !== 'number'
  ) {
    return null;
  }

  const p = parsed as CleanerPayloadV1;
  if (Date.now() > p.exp) return null;

  return { cleanerId: p.cid };
}
