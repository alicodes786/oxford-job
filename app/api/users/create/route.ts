import { NextResponse } from 'next/server';
import { getDashboardUserFromCookies } from '@/lib/dashboard-user-from-cookies';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { hashPasswordForStorage } from '@/lib/password';

export async function POST(request: Request) {
  const actor = await getDashboardUserFromCookies();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
  const email =
    typeof body === 'object' && body !== null && 'email' in body
      ? String((body as { email: unknown }).email ?? '').trim()
      : '';
  const passwordRaw =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password: unknown }).password ?? '')
      : '';
  const role =
    typeof body === 'object' &&
    body !== null &&
    'role' in body &&
    ((body as { role: unknown }).role === 'sub-admin' ||
      (body as { role: unknown }).role === 'user')
      ? (body as { role: 'sub-admin' | 'user' }).role
      : null;

  if (!username || !email || !passwordRaw || !role) {
    return NextResponse.json(
      { error: 'username, email, password, and role are required' },
      { status: 400 },
    );
  }

  try {
    const password = await hashPasswordForStorage(passwordRaw);
    const admin = getSupabaseAdmin();
    const { error } = await admin.from('users').insert({
      username,
      email,
      password,
      role,
    });

    if (error) {
      console.error('[users/create]', error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[users/create]', e);
    return NextResponse.json({ error: 'Unable to create user' }, { status: 500 });
  }
}
