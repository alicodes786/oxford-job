import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5'); // Default to 5
    const listingName = url.searchParams.get('listingName');
    
    // Get recent events with cleaner assignments
    let query = supabase
      .from('events')
      .select(`
        *,
        cleaner_assignments (
          uuid,
          cleaner_uuid,
          hours,
          cleaner:cleaners (
            id,
            name,
            hourly_rate
          )
        )
      `)
      // Order by most recent activity (either creation or update)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // Add listing filter if provided
    if (listingName) {
      query = query.eq('listing_name', listingName);
    }
    
    const { data: events, error } = await query;
    
    if (error) throw error;
    
    // Debug logging
    console.log('Total events fetched:', events?.length || 0);
    console.log('Active events:', events?.filter(e => e.is_active).length || 0);
    console.log('Cancelled events:', events?.filter(e => !e.is_active).length || 0);
    
    // Format events for the frontend
    const formattedEvents = (events || []).map(event => {
      // Get cleaner info if available
      let cleaner = null;
      if (event.cleaner_assignments && event.cleaner_assignments.length > 0) {
        const assignment = event.cleaner_assignments[0];
        if (assignment.cleaner) {
          cleaner = {
            id: assignment.cleaner.id,
            name: assignment.cleaner.name,
            hourlyRate: assignment.cleaner.hourly_rate,
            hours: assignment.hours
          };
        }
      }
      
      // Determine the most recent activity time
      const mostRecentActivity = event.updated_at || event.created_at;
      
      return {
        id: event.uuid,
        uuid: event.uuid,
        eventId: event.event_id,
        title: event.title || `Booking ${event.checkout_type === 'same_day' ? '(Same Day)' : '(Open)'}${!event.is_active ? ' (Cancelled)' : ''}`,
        start: event.checkin_date,
        end: event.checkout_date,
        listing: event.listing_name,
        listingName: event.listing_name,
        checkoutType: event.checkout_type,
        checkoutTime: event.checkout_time,
        cleaner: cleaner,
        eventType: event.event_type,
        listingHours: event.listing_hours,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        mostRecentActivity: mostRecentActivity,
        isActive: event.is_active,
        isCancelled: !event.is_active
      };
    });
    
    return NextResponse.json({
      success: true,
      events: formattedEvents,
      count: formattedEvents.length
    });
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 