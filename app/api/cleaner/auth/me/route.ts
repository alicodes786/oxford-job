import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { CLEANER_SESSION_COOKIE, unsealCleanerSession } from '@/lib/cleaner-session';
import type { Cleaner } from '@/lib/models';

const cleanerCookieClear = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 0,
};

export async function GET() {
  const jar = await cookies();
  const token = jar.get(CLEANER_SESSION_COOKIE)?.value;
  const sess = await unsealCleanerSession(token);

  /** Stale or invalid cookie: clear it so middleware won’t block `/cleaner/login`. */
  const jsonWithClearCookie = (body: object) => {
    const res = NextResponse.json(body);
    res.cookies.set(CLEANER_SESSION_COOKIE, '', cleanerCookieClear);
    return res;
  };

  if (!sess) {
    if (token) {
      return jsonWithClearCookie({ cleaner: null });
    }
    return NextResponse.json({ cleaner: null });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from('cleaners')
      .select('*')
      .eq('id', sess.cleanerId)
      .maybeSingle();

    if (error || !row) {
      return jsonWithClearCookie({ cleaner: null });
    }

    const { password: _pw, ...rest } = row;
    const cleaner: Omit<Cleaner, 'password'> & { uuid: string } = {
      ...rest,
      uuid: row.id,
    };

    return NextResponse.json({ cleaner });
  } catch (e) {
    console.error('[cleaner/auth/me]', e);
    return jsonWithClearCookie({ cleaner: null });
  }
}
