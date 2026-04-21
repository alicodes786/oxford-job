import { timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Verify login password against stored value.
 * Supports bcrypt hashes ($2a$/...) and legacy plain-text rows (timing-safe equality when lengths match).
 */
export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (stored == null || stored === '') return false;
  const s = stored.trim();
  if (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$')) {
    return bcrypt.compare(plain, s);
  }
  const a = Buffer.from(plain, 'utf8');
  const b = Buffer.from(s, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Store bcrypt hashes for new or updated passwords (cost 12 — reasonable default for ~2026). */
export async function hashPasswordForStorage(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
