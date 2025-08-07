import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface Cleaner {
  id: string;
  name: string;
}

interface CleanerMap {
  [key: string]: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    // First get notifications
    const { data: notifications, error } = await supabase
      .from('job_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch notifications'
      }, { status: 500 });
    }

    // Then get cleaner names in a separate query
    const cleanerUuids = [...new Set(notifications.map(n => n.cleaner_uuid))];
    const { data: cleaners, error: cleanersError } = await supabase
      .from('cleaners')
      .select('id, name')
      .in('id', cleanerUuids);

    if (cleanersError) {
      console.error('Error fetching cleaner names:', cleanersError);
    }

    // Create a map of cleaner IDs to names
    const cleanerMap: CleanerMap = (cleaners || []).reduce((map: CleanerMap, cleaner: Cleaner) => {
      map[cleaner.id] = cleaner.name;
      return map;
    }, {});

    // Format notifications for frontend
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      assignment_uuid: notification.assignment_uuid,
      cleaner_uuid: notification.cleaner_uuid,
      cleaner_name: cleanerMap[notification.cleaner_uuid] || 'Unknown Cleaner',
      listing_name: notification.listing_name,
      completion_date: notification.completion_date,
      cleanliness_rating: notification.cleanliness_rating,
      damage_question: notification.damage_question,
      duration_minutes: notification.duration_minutes,
      created_at: notification.created_at,
      is_read: notification.is_read
    }));

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications
    });

  } catch (error) {
    console.error('Error processing notifications request:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 