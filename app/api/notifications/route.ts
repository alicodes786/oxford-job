import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { CLEANER_SESSION_COOKIE, unsealCleanerSession } from '@/lib/cleaner-session';

export async function GET(request: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(CLEANER_SESSION_COOKIE)?.value;
    const sess = await unsealCleanerSession(token);

    if (!sess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const qpUuid = searchParams.get('cleaner_uuid');
    if (qpUuid && qpUuid !== sess.cleanerId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const cleanerUuid = sess.cleanerId;
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('cleaner_uuid', cleanerUuid)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('Error processing notifications request:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
