import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const cleanerUuid = searchParams.get('cleaner_uuid');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!cleanerUuid) {
      return NextResponse.json({
        success: false,
        error: 'cleaner_uuid is required'
      }, { status: 400 });
    }

    // Get notifications for the cleaner
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('cleaner_uuid', cleanerUuid)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch notifications'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      notifications
    });

  } catch (error) {
    console.error('Error processing notifications request:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 