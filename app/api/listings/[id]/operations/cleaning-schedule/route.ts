import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { differenceInDays, parseISO } from 'date-fns';

// GET - Fetch cleaning schedule for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    // Get listing name first
    const { data: listing } = await supabase
      .from('listings')
      .select('name')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return NextResponse.json({
        success: false,
        error: 'Listing not found'
      }, { status: 404 });
    }

    const listingName = listing.name;

    // Get last cleaning date from job_completions
    const { data: lastCompletion } = await supabase
      .from('job_completions')
      .select('completion_date')
      .eq('listing_name', listingName)
      .order('completion_date', { ascending: false })
      .limit(1)
      .single();

    // Get next cleaning date - First, get upcoming events for this listing
    const { data: upcomingEvents } = await supabase
      .from('events')
      .select('uuid, checkout_date, listing_name')
      .eq('listing_name', listingName)
      .eq('is_active', true)
      .gte('checkout_date', new Date().toISOString().split('T')[0])
      .order('checkout_date', { ascending: true })
      .limit(10); // Get next 10 events

    const lastCleaningDate = lastCompletion?.completion_date || null;
    let nextCleaningDate = null;

    // If we have upcoming events, check which has a cleaner assigned
    if (upcomingEvents && upcomingEvents.length > 0) {
      const eventUuids = upcomingEvents.map(e => e.uuid);
      const { data: assignments } = await supabase
        .from('cleaner_assignments')
        .select('event_uuid')
        .in('event_uuid', eventUuids)
        .eq('is_active', true)
        .order('event_uuid', { ascending: true });

      // Find the first event that has an assignment
      if (assignments && assignments.length > 0) {
        const assignedEventUuid = assignments[0].event_uuid;
        const nextEvent = upcomingEvents.find(e => e.uuid === assignedEventUuid);
        nextCleaningDate = nextEvent?.checkout_date || null;
      }
    }

    let status: 'on_time' | 'overdue' | 'no_schedule' = 'no_schedule';
    let daysUntilNext: number | null = null;

    if (nextCleaningDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextDate = parseISO(nextCleaningDate);
      nextDate.setHours(0, 0, 0, 0);
      
      daysUntilNext = differenceInDays(nextDate, today);
      
      if (daysUntilNext < 0) {
        status = 'overdue';
      } else {
        status = 'on_time';
      }
    } else if (lastCleaningDate) {
      // If we have past cleanings but no future ones, mark as no_schedule
      status = 'no_schedule';
    }

    return NextResponse.json({
      success: true,
      schedule: {
        last_cleaning_date: lastCleaningDate,
        next_cleaning_date: nextCleaningDate,
        status,
        days_until_next: daysUntilNext
      }
    });
  } catch (error) {
    console.error('Error fetching cleaning schedule:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch cleaning schedule'
    }, { status: 500 });
  }
}

