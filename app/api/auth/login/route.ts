import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/password';
import {
  DASHBOARD_SESSION_COOKIE,
  sealSession,
  sessionCookieMaxAgeSec,
} from '@/lib/auth-session';
import type { User } from '@/lib/supabase';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const username =
    typeof body === 'object' && body !== null && 'username' in body
      ? String((body as { username: unknown }).username ?? '').trim()
      : '';
  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password: unknown }).password ?? '')
      : '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from('users')
      .select('id, username, email, role, password')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('[auth/login] Supabase error:', error.message);
      return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 503 });
    }

    if (!row || !(await verifyPassword(password, row.password))) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email ?? '',
      role: row.role,
    };

    const maxAge = sessionCookieMaxAgeSec();
    const expMs = Date.now() + maxAge * 1000;
    const token = await sealSession(user, expMs);

    const res = NextResponse.json({ user });
    res.cookies.set(DASHBOARD_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes('SUPABASE_SERVICE_ROLE_KEY') || message.includes('SESSION_SECRET')) {
      console.error('[auth/login] configuration error');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    console.error('[auth/login]', e);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}
