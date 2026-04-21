import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { DASHBOARD_SESSION_COOKIE, unsealSession } from '@/lib/auth-session';
import type { User } from '@/lib/supabase';

const dashCookieClear = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
};

export async function GET() {
  const jar = await cookies();
  const token = jar.get(DASHBOARD_SESSION_COOKIE)?.value;
  const session = await unsealSession(token);

  const jsonWithClearCookie = () => {
    const res = NextResponse.json({ user: null as User | null });
    res.cookies.set(DASHBOARD_SESSION_COOKIE, '', dashCookieClear);
    return res;
  };

  if (!session) {
    if (token) {
      return jsonWithClearCookie();
    }
    return NextResponse.json({ user: null as User | null });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from('users')
      .select('id, username, email, role')
      .eq('id', session.id)
      .maybeSingle();

    if (error || !row) {
      return jsonWithClearCookie();
    }

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email ?? '',
      role: row.role,
    };

    return NextResponse.json({ user });
  } catch (e) {
    console.error('[auth/me]', e);
    return jsonWithClearCookie();
  }
}
