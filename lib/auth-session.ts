/** HTTP-only cookie carrying an HMAC-signed payload (not a browser-stored JWT). */

export const DASHBOARD_SESSION_COOKIE = 'oxford_dashboard_session';

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'sub-admin';
};

type PayloadV1 = {
  v: 1;
  id: number;
  u: string;
  e: string;
  r: 'admin' | 'user' | 'sub-admin';
  /** Absolute expiry time (unix ms). */
  exp: number;
};

function isRole(r: unknown): r is PayloadV1['r'] {
  return r === 'admin' || r === 'user' || r === 'sub-admin';
}

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

export function getSessionSecret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set to a random string of at least 32 characters (e.g. openssl rand -hex 32)',
    );
  }
  return s;
}

/** Cookie Max-Age in seconds (browser session length). */
export function sessionCookieMaxAgeSec(): number {
  const raw = process.env.SESSION_MAX_AGE_DAYS?.trim();
  const days = raw !== undefined && raw !== '' ? Number(raw) : 30;
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return 60 * 60 * 24 * 30;
  }
  return Math.floor(days * 24 * 60 * 60);
}

export async function sealSession(user: SessionUser, expMs: number): Promise<string> {
  const secret = getSessionSecret();
  const payload: PayloadV1 = {
    v: 1,
    id: user.id,
    u: user.username,
    e: user.email,
    r: user.role,
    exp: expMs,
  };
  const payloadB64 = bytesToBase64Url(te.encode(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function unsealSession(token: string | undefined): Promise<SessionUser | null> {
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
    (parsed as PayloadV1).v !== 1 ||
    typeof (parsed as PayloadV1).exp !== 'number' ||
    typeof (parsed as PayloadV1).id !== 'number' ||
    typeof (parsed as PayloadV1).u !== 'string' ||
    typeof (parsed as PayloadV1).e !== 'string' ||
    !isRole((parsed as PayloadV1).r)
  ) {
    return null;
  }

  const p = parsed as PayloadV1;
  if (Date.now() > p.exp) return null;

  return {
    id: p.id,
    username: p.u,
    email: p.e,
    role: p.r,
  };
}
