import { cookies } from 'next/headers';
import { DASHBOARD_SESSION_COOKIE, unsealSession } from '@/lib/auth-session';
import type { User } from '@/lib/supabase';

export async function getDashboardUserFromCookies(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(DASHBOARD_SESSION_COOKIE)?.value;
  const session = await unsealSession(token);
  if (!session) return null;
  return {
    id: session.id,
    username: session.username,
    email: session.email,
    role: session.role,
  };
}
