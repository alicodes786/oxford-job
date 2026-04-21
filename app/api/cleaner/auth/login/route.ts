import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyPassword } from '@/lib/password';
import {
  CLEANER_SESSION_COOKIE,
  sealCleanerSession,
  sessionCookieMaxAgeSec,
} from '@/lib/cleaner-session';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name =
    typeof body === 'object' && body !== null && 'name' in body
      ? String((body as { name: unknown }).name ?? '').trim()
      : '';
  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password: unknown }).password ?? '')
      : '';

  if (!name || !password) {
    return NextResponse.json({ error: 'Name and password are required' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from('cleaners')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) {
      console.error('[cleaner/auth/login] Supabase error:', error.message);
      return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 503 });
    }

    if (!row || !(await verifyPassword(password, row.password))) {
      return NextResponse.json({ error: 'Invalid name or password' }, { status: 401 });
    }

    const maxAge = sessionCookieMaxAgeSec();
    const expMs = Date.now() + maxAge * 1000;
    const token = await sealCleanerSession(row.id, expMs);

    const { password: _pw, ...rest } = row;
    const cleaner = { ...rest, uuid: row.id };

    const res = NextResponse.json({ cleaner });
    res.cookies.set(CLEANER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes('SUPABASE_SERVICE_ROLE_KEY') ||
      message.includes('NEXT_PUBLIC_SUPABASE_URL') ||
      message.includes('SESSION_SECRET')
    ) {
      console.error('[cleaner/auth/login] configuration error');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    console.error('[cleaner/auth/login]', e);
    return NextResponse.json({ error: 'Unable to sign in right now' }, { status: 500 });
  }
}
