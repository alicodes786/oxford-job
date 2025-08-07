import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface Cleaner {
  id: string;
  name: string;
  hourly_rate: number;
}

interface CleanerAssignment {
  uuid: string;
  cleaner_uuid: string;
  hours: number;
  cleaner?: Cleaner;
}

interface Event {
  uuid: string;
  event_id: string;
  listing_id: string | null;
  listing_name: string;
  checkin_date: string;
  checkout_date: string;
  checkout_type: 'same_day' | 'open';
  checkout_time: string;
  is_active: boolean;
  cleaner_assignments?: CleanerAssignment[];
  event_type: string;
  listing_hours: number;
  recurrence_type?: string;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const listingName = url.searchParams.get('listingName');
    const includeAssignments = url.searchParams.get('includeAssignments') === 'true';
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: startDate and endDate'
      }, { status: 400 });
    }
    
    // Build query
    const query = includeAssignments 
      ? supabase
          .from('events')
          .select(`
            *,
            event_type,
            listing_hours,
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
          .gte('checkin_date', startDate)
          .lte('checkout_date', endDate)
          .eq('is_active', true)
      : supabase
          .from('events')
          .select('*, event_type, listing_hours')
          .gte('checkin_date', startDate)
          .lte('checkout_date', endDate)
          .eq('is_active', true);
    
    // Add listing filter if provided
    if (listingName) {
      query.eq('listing_name', listingName);
    }
    
    // Execute query
    const { data: events, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Format events for the calendar component
    const formattedEvents = (events as Event[]).map(event => {
      // Format the title based on the checkout type
      const checkoutInfo = event.checkout_type === 'same_day' 
        ? `(Same Day: ${event.checkout_time})` 
        : `(Checkout: ${event.checkout_time})`;
      
      // Get cleaner info if available
      let cleaner = null;
      if (includeAssignments && event.cleaner_assignments && event.cleaner_assignments.length > 0) {
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
        
              return {
        id: event.uuid,
        uuid: event.uuid,
        eventId: event.event_id || event.uuid,
        title: `Booking ${checkoutInfo}`,
        start: event.checkin_date,
        end: event.checkout_date,
        listing: event.listing_name,
        listingName: event.listing_name,
        isCheckIn: true,
        isCheckOut: true,
        isSameDayCheckout: event.checkout_type === 'same_day',
        checkoutTime: event.checkout_time,
        checkoutType: event.checkout_type,
        color: event.checkout_type === 'same_day' ? '#ff9800' : undefined, // Highlight same-day checkouts
        cleaner: cleaner, // Include cleaner info if available
        eventType: event.event_type, // Pass event_type to frontend
        listingHours: event.listing_hours, // Pass listing_hours to frontend
        recurrence_type: event.recurrence_type // Pass recurrence_type to frontend for recurring event labels
      };
    });
    
    return NextResponse.json({
      success: true,
      events: formattedEvents,
      count: formattedEvents.length,
      params: {
        startDate,
        endDate,
        listingName: listingName || 'all'
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 