import { NextResponse } from 'next/server';
import { getDashboardUserFromCookies } from '@/lib/dashboard-user-from-cookies';
import { hashPasswordForStorage } from '@/lib/password';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  const actor = await getDashboardUserFromCookies();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { userId, cleanerId, password } = await request.json();

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    if (userId != null && userId !== '') {
      const hashed = await hashPasswordForStorage(password);
      const { error } = await admin.from('users').update({ password: hashed }).eq('id', userId);

      if (error) throw error;
    } else if (cleanerId != null && cleanerId !== '') {
      const { error } = await admin.from('cleaners').update({ password }).eq('id', cleanerId);

      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'No user or cleaner ID provided' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
