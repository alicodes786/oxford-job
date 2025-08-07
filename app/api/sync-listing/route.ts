import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getListings, getIcalFeedsForListing } from '@/lib/models';
import { createSyncReport, completeSyncReport, SyncConfig } from '@/lib/sync-reporting';
import { SyncLogger } from '@/lib/sync-logging';
import { SyncDatabaseLogger } from '@/lib/sync-database-logger';

// Define event types for better type safety
interface ICalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  listing: string;
}

// Interface for tracking results per listing
interface SyncResult {
  listingId: string;
  listingName: string;
  feedsProcessed: number;
  added: number;
  updated: number;
  deactivated: number;
  replaced: number;
  unchanged: number;
  errors: number;
  events: number;
  status: 'success' | 'error';
  errorMessage?: string;
  detailedLogs?: any[]; // Will contain SyncLogEntry[]
}

// Function to send notification via Slack webhook
async function sendSlackNotification(title: string, content: string) {
  try {
    // Use the webhook URL from environment variables
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/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';
    
    // Create a simple Slack message
    const message = {
      text: title,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: title,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: content
          }
        }
      ]
    };
    
    // Send to webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Slack notification sent: ${title}`);
    return true;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return false;
  }
}

// Function to format dates for notification display
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Function to determine checkout type based on other events
async function determineCheckoutType(checkoutDate: string, listingName: string, allEvents: ICalEvent[]) {
  const checkoutDateOnly = new Date(checkoutDate).toISOString().split('T')[0];
  
  // Get all events for this listing, filtering out "Not available" events
  const listingEvents = allEvents.filter(e => 
    e.listing === listingName && 
    e.title !== 'Airbnb (Not available)'
  );
  
  console.log(`\n=== Determining checkout type for ${listingName} on ${checkoutDateOnly} ===`);
  console.log(`Found ${listingEvents.length} valid events for this listing (excluding "Not available" events)`);
  
  // Sort events by start date for better readability in logs
  const sortedEvents = [...listingEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  console.log('Events for this listing (sorted by date):');
  sortedEvents.forEach(e => {
    const start = new Date(e.start).toISOString().split('T')[0];
    const end = new Date(e.end).toISOString().split('T')[0];
    console.log(`- ${start} to ${end} (${e.id})`);
  });
  
  // Find any event that starts (check-in) on our checkout date
  const sameDayEvents = listingEvents.filter(event => {
    const eventCheckinDate = new Date(event.start).toISOString().split('T')[0];
    const eventCheckoutDate = new Date(event.end).toISOString().split('T')[0];
    
    // An event is a same-day match if:
    // 1. Its check-in date matches our checkout date
    // 2. It's not the same event we're checking (different checkout dates)
    const isSameDay = eventCheckinDate === checkoutDateOnly && eventCheckoutDate !== checkoutDateOnly;
    
    if (eventCheckinDate === checkoutDateOnly) {
      console.log('Found event with matching date:', {
        id: event.id,
        title: event.title,
        checkin: eventCheckinDate,
        checkout: eventCheckoutDate,
        isSameDay,
        reason: isSameDay ? 'Same day checkout found' : 'Same event - not a match'
      });
    }
    
    return isSameDay;
  });
  
  if (sameDayEvents.length > 0) {
    console.log('✓ SAME DAY: Found matching events:', sameDayEvents.map(e => ({
      id: e.id,
      title: e.title,
      checkin: new Date(e.start).toISOString().split('T')[0],
      checkout: new Date(e.end).toISOString().split('T')[0]
    })));
    return 'same_day';
  }
  
  // If not found in current batch, check the database for existing events
  console.log('Checking database for same-day events...');
  const { data: existingSameDay } = await supabase
    .from('events')
    .select('uuid, event_id, listing_name, checkin_date, checkout_date')
    .eq('listing_name', listingName)
    .eq('checkin_date::date', checkoutDateOnly)
    .eq('is_active', true)
    .eq('event_type', 'ical')
    .neq('checkout_date::date', checkoutDateOnly);

  if (existingSameDay && existingSameDay.length > 0) {
    console.log('✓ SAME DAY: Found in database:', existingSameDay);
    return 'same_day';
  }

  console.log('✗ OPEN: No same-day events found\n');
  return 'open';
}

// Function to get listing hours from the listings table
async function getListingHours(listingId: string) {
  // Get listing by ID
  const { data: listing } = await supabase
    .from('listings')
    .select('hours, name')
    .eq('id', listingId)
    .single();

  return listing ? {
    hours: listing.hours || 2.0,
    name: listing.name
  } : {
    hours: 2.0,
    name: 'Unknown Listing'
  };
}

// Function to check if the dates of an event have changed
function haveDatesChanged(existingEvent: any, newEvent: ICalEvent) {
  // First check if this is the same event by event_id
  if (existingEvent.event_id !== newEvent.id) {
    return false; // Different events, don't consider it a change
  }
  
  // Compare only the date portions (not full timestamps) to avoid time zone issues
  const existingCheckin = new Date(existingEvent.checkin_date).toISOString().split('T')[0];
  const existingCheckout = new Date(existingEvent.checkout_date).toISOString().split('T')[0];
  const newCheckin = new Date(newEvent.start).toISOString().split('T')[0];
  const newCheckout = new Date(newEvent.end).toISOString().split('T')[0];
  
  return existingCheckin !== newCheckin || existingCheckout !== newCheckout;
}

// Function to fetch events from a single feed
async function fetchEventsFromFeed(
  feed: any,
  apiBaseUrl: string
): Promise<{ events: ICalEvent[], detectedListingName: string }> {
  try {
    console.log(`\n=== Fetching events from feed: ${feed.name} (${feed.id}) ===`);
    console.log('Feed details:', {
      name: feed.name,
      id: feed.id,
      listingId: feed.listing_id,
      url: feed.url
    });
    
    // Step 1: Fetch events from the iCal feed
    const response = await fetch(`${apiBaseUrl}/api/fetch-ical`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: feed.url,
        listingId: feed.listing_id,
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()  // 180 days ahead
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch iCal events for feed ${feed.name}: ${response.statusText}`);
    }
    
    const { events, detectedListingName } = await response.json();
    
    if (!events || events.length === 0) {
      console.log(`No events found in feed ${feed.name}`);
      return { events: [], detectedListingName: 'Unknown Listing' };
    }

    // Filter out "Not available" events immediately
    const filteredEvents = (events as ICalEvent[]).filter(event => event.title !== 'Airbnb (Not available)');
    console.log(`Filtered out ${events.length - filteredEvents.length} "Not available" events`);
    
    // Verify listing names are set correctly
    const eventsWithListingName = filteredEvents.map((event: ICalEvent) => {
      const listing = event.listing || detectedListingName || feed.name;
      if (event.listing !== listing) {
        console.log(`Setting listing name for event ${event.id}:`, {
          from: event.listing || '(none)',
          to: listing
        });
      }
      return {
        ...event,
        listing
      };
    });
    
    console.log(`\nProcessed ${eventsWithListingName.length} valid events from feed ${feed.name}:`);
    eventsWithListingName.forEach((e: ICalEvent) => {
      console.log(`- ${new Date(e.start).toISOString().split('T')[0]} to ${new Date(e.end).toISOString().split('T')[0]} (${e.id}) "${e.title}"`);
    });
    
    return { events: eventsWithListingName, detectedListingName };
  } catch (error) {
    console.error(`Error fetching events from feed ${feed.name}:`, error);
    return { events: [], detectedListingName: 'Unknown Listing' };
  }
}

// Function to log event changes to the database
async function logEventChange(
  listingName: string,
  changeType: 'modified' | 'cancelled',
  eventId: string,
  oldEvent?: any,
  newEvent?: any
) {
  try {
    // For modifications, only log if it's the same event (by event_id) and dates actually changed
    if (changeType === 'modified' && oldEvent && newEvent) {
      if (oldEvent.event_id !== eventId) {
        return false; // Different events, don't log as a change
      }
      
      const oldCheckin = new Date(oldEvent.checkin_date).toISOString().split('T')[0];
      const oldCheckout = new Date(oldEvent.checkout_date).toISOString().split('T')[0];
      const newCheckin = new Date(newEvent.start).toISOString().split('T')[0];
      const newCheckout = new Date(newEvent.end).toISOString().split('T')[0];
      
      if (oldCheckin === newCheckin && oldCheckout === newCheckout) {
        return false; // Dates haven't changed, don't log
      }
    }

    // First check if we've already logged this exact change
    const { data: existingChange } = await supabase
      .from('event_changes')
      .select('*')
      .eq('listing_name', listingName)
      .eq('event_id', eventId)
      .eq('change_type', changeType)
      .eq('old_checkin_date', oldEvent?.checkin_date || oldEvent?.start)
      .eq('old_checkout_date', oldEvent?.checkout_date || oldEvent?.end)
      .eq('new_checkin_date', newEvent?.start)
      .eq('new_checkout_date', newEvent?.end)
      .maybeSingle();

    // If we've already logged this exact change, don't log it again
    if (existingChange) {
      console.log(`Change already logged for event ${eventId} in listing ${listingName}`);
      return false;
    }

    const changeData = {
      listing_name: listingName,
      event_id: eventId,
      change_type: changeType,
      old_checkin_date: oldEvent?.checkin_date || oldEvent?.start,
      old_checkout_date: oldEvent?.checkout_date || oldEvent?.end,
      new_checkin_date: newEvent?.start,
      new_checkout_date: newEvent?.end,
      old_event_id: oldEvent?.event_id
    };

    const { error } = await supabase
      .from('event_changes')
      .insert(changeData);

    if (error) {
      console.error('Failed to log event change:', error);
      return false;
    }
    
    // Only return true for new changes that were successfully logged
    return true;
  } catch (error) {
    console.error('Error logging event change:', error);
    return false;
  }
}

// Utility: Mark all cleaner assignments for a given event as inactive
async function markCleanerAssignmentsInactiveForEvent(eventUuid: string) {
  const { error } = await supabase
    .from('cleaner_assignments')
    .update({ is_active: false })
    .eq('event_uuid', eventUuid);
  if (error) {
    console.error(`Failed to mark cleaner assignments inactive for event ${eventUuid}:`, error);
  }
}

// Utility: Mark all cleaner assignments for multiple events as inactive
async function markCleanerAssignmentsInactiveForEvents(eventUuids: string[]) {
  if (!eventUuids.length) return;
  const { error } = await supabase
    .from('cleaner_assignments')
    .update({ is_active: false })
    .in('event_uuid', eventUuids);
  if (error) {
    console.error(`Failed to mark cleaner assignments inactive for events:`, eventUuids, error);
  }
}

// Function to re-evaluate checkout types for all active events in a listing
async function reEvaluateCheckoutTypes(listingName: string, allEvents: ICalEvent[]) {
  try {
    console.log(`\n=== Re-evaluating checkout types for ${listingName} ===`);
    
    // Get all active events for this listing from the database
    const { data: activeEvents } = await supabase
      .from('events')
      .select('*')
      .eq('listing_name', listingName)
      .eq('is_active', true)
      .eq('event_type', 'ical');
      
    if (!activeEvents || activeEvents.length === 0) {
      console.log('No active events found to re-evaluate');
      return;
    }
    
    console.log(`Found ${activeEvents.length} active events to re-evaluate`);
    
    // Re-evaluate each event's checkout type
    for (const event of activeEvents) {
      const newCheckoutType = await determineCheckoutType(event.checkout_date, listingName, allEvents);
      
      // If checkout type has changed, update the event
      if (newCheckoutType !== event.checkout_type) {
        console.log(`Checkout type changed for event ${event.uuid}:`, {
          from: event.checkout_type,
          to: newCheckoutType
        });
        
        const { error } = await supabase
          .from('events')
          .update({ 
            checkout_type: newCheckoutType,
            updated_at: new Date().toISOString()
          })
          .eq('uuid', event.uuid);
          
        if (error) {
          console.error(`Error updating checkout type for event ${event.uuid}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error re-evaluating checkout types for ${listingName}:`, error);
  }
}

// Function to process all events for a single listing
async function processListingEvents(
  listingId: string,
  listingName: string,
  listingHours: number,
  feeds: any[],
  apiBaseUrl: string,
  dbLogger: SyncDatabaseLogger
): Promise<SyncResult> {
  const logger = new SyncLogger(listingName);
  
  const result: SyncResult = {
    listingId,
    listingName,
    feedsProcessed: feeds.length,
    added: 0,
    updated: 0,
    deactivated: 0,
    replaced: 0,
    unchanged: 0,
    errors: 0,
    events: 0,
    status: 'success',
    detailedLogs: []
  };
  
  try {
    console.log(`\n=== Processing ${feeds.length} feeds for listing: ${listingName} ===`);
    
    // First, collect all events from all feeds
    const allEventsPromises = feeds.map(feed => fetchEventsFromFeed(feed, apiBaseUrl));
    const allEventResults = await Promise.all(allEventsPromises);
    
    // Update last_synced timestamp for all feeds regardless of whether events were found
    await Promise.all(feeds.map(feed => 
      supabase
        .from('ical_feeds')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', feed.id)
    ));
    
    // Collate all events and determine the most accurate listing name
    let allEvents: ICalEvent[] = [];
    let finalListingName = listingName;
    
    allEventResults.forEach(({ events, detectedListingName }) => {
      // Filter out "Airbnb (Not available)" events and add remaining events to our combined array
      const filteredEvents = events.filter(event => event.title !== 'Airbnb (Not available)');
      const eventsWithListing = filteredEvents.map(event => ({
        ...event,
        listing: finalListingName // Use the listing name we know is correct
      }));
      allEvents = [...allEvents, ...eventsWithListing];
    });
    
    console.log(`\nCollected ${allEvents.length} events for ${finalListingName}:`);
    allEvents.forEach(e => {
      console.log(`- ${new Date(e.start).toISOString().split('T')[0]} to ${new Date(e.end).toISOString().split('T')[0]} (${e.id})`);
    });
    
    // Skip further processing if no events found across all feeds
    if (allEvents.length === 0) {
      console.log(`No events found across ${feeds.length} feeds for listing ${finalListingName}`);
      return result;
    }
    
    result.events = allEvents.length;
    
    // Get current date for comparison (to preserve past events)
    const today = new Date();
    
    // Get all active iCal events for this listing from our database
    const { data: existingEvents } = await supabase
      .from('events')
      .select('*')
      .eq('listing_name', finalListingName)
      .eq('is_active', true)
      .eq('event_type', 'ical');
      
    // Create a map of event IDs for efficient lookup
    const incomingEventIds = allEvents.map(event => event.id);
    
    // Track events that need to be marked as inactive (potential cancellations or changes)
    const eventsToDeactivate = [];
    const canceledEvents = [];
    
    // Check for events that might be canceled or changed
    if (existingEvents) {
      for (const existingEvent of existingEvents) {
        const eventId = existingEvent.event_id;
        
        // Skip if the event is in the past (preserve past events)
        const checkoutDate = new Date(existingEvent.checkout_date);
        if (checkoutDate < today) {
          continue;
        }
        
        // Check if this event still exists in the incoming events
        if (!incomingEventIds.includes(eventId)) {
          eventsToDeactivate.push(existingEvent.uuid);
          
          // Log the deactivation with detailed reasoning
          logger.logEventCancellation(
            existingEvent.event_id,
            {
              checkinDate: existingEvent.checkin_date,
              checkoutDate: existingEvent.checkout_date,
              checkoutType: existingEvent.checkout_type
            },
            `Event no longer exists in iCal feed - was cancelled or removed from source`,
            {
              uuid: existingEvent.uuid,
              feedName: 'Multiple feeds checked',
              sqlOperation: 'UPDATE',
              updatedFields: 'is_active=false'
            }
          );
          
          // Only add to canceledEvents if this is a new change
          const isNewChange = await logEventChange(
            existingEvent.listing_name,
            'cancelled',
            existingEvent.event_id,
            existingEvent
          );
          
          if (isNewChange) {
            canceledEvents.push({
              checkin: existingEvent.checkin_date,
              checkout: existingEvent.checkout_date,
              listing: existingEvent.listing_name
            });
          }
        }
      }
    }
    
    // Deactivate events that were canceled
    if (eventsToDeactivate.length > 0) {
      await supabase
        .from('events')
        .update({ is_active: false })
        .in('uuid', eventsToDeactivate);
      // Also mark cleaner assignments as inactive for these events
      await markCleanerAssignmentsInactiveForEvents(eventsToDeactivate);
      result.deactivated = eventsToDeactivate.length;
    }
    
    // Send Slack notification about canceled events
    if (canceledEvents.length > 0) {
      let notificationText = '*Canceled Bookings:*\n\n';
      
      canceledEvents.forEach(event => {
        notificationText += `• *Listing:* ${event.listing}\n`;
        notificationText += `• *Check-in:* ${formatDate(event.checkin)}\n`;
        notificationText += `• *Check-out:* ${formatDate(event.checkout)}\n\n`;
      });
      
      notificationText += 'Please review these changes and take appropriate action.';
      
      await sendSlackNotification('🚨 Booking Cancellation Alert', notificationText);
    }
    
    // Track modified events for notification
    const modifiedEvents = [];
    
    // Now process all events with the combined checkout-type logic
    for (const event of allEvents) {
      try {
        // Skip processing if this is a "Not available" event
        if (event.title === 'Airbnb (Not available)') {
          // Skip these events - they are filtered out automatically
          continue;
        }

        console.log(`\n--- Processing event ${event.id} (${new Date(event.start).toISOString().split('T')[0]} to ${new Date(event.end).toISOString().split('T')[0]}) ---`);

        // For each event, determine if it's a same-day checkout by comparing with all events
        const checkoutType = await determineCheckoutType(event.end, finalListingName, allEvents);
        
        // FRESH LOOKUP: Check by event_id (this query is always fresh)
        const { data: existingEventById } = await supabase
          .from('events')
          .select('*')
          .eq('event_id', event.id)
          .eq('is_active', true)
          .maybeSingle();
        
        console.log(`Event ${event.id} - Found by ID:`, existingEventById ? `Yes (${existingEventById.uuid})` : 'No');
        
        // FRESH LOOKUP: Check by date range (always fresh, not using stale array)
        const { data: existingEventsByDates } = await supabase
          .from('events')
          .select('*')
          .eq('listing_name', finalListingName)
          .eq('checkin_date::date', new Date(event.start).toISOString().split('T')[0])
          .eq('checkout_date::date', new Date(event.end).toISOString().split('T')[0])
          .eq('is_active', true)
          .eq('event_type', 'ical');
          
        const existingEventByDates = existingEventsByDates && existingEventsByDates.length > 0 ? existingEventsByDates[0] : null;
        
        console.log(`Event ${event.id} - Found by dates:`, existingEventByDates ? `Yes (${existingEventByDates.uuid}, event_id: ${existingEventByDates.event_id})` : 'No');
        
        // Determine which existing event to use
        const existingEvent = existingEventById || existingEventByDates;
        
        if (existingEvent) {
          console.log(`Event ${event.id} - Using existing event: ${existingEvent.uuid} (event_id: ${existingEvent.event_id})`);
          
          // Check if dates have changed (only meaningful if we found by event_id)
          const datesHaveChanged = existingEventById ? haveDatesChanged(existingEventById, event) : false;
          
          console.log(`Event ${event.id} - Dates changed:`, datesHaveChanged);
          console.log(`Event ${event.id} - Found by ID:`, !!existingEventById);
          console.log(`Event ${event.id} - Found by dates:`, !!existingEventByDates);
          
          // CASE 1: Found by date range but different event_id (replacement scenario)
          if (existingEventByDates && !existingEventById && existingEventByDates.event_id !== event.id) {
            console.log(`Event ${event.id} - CASE 1: Different event_id for same dates - replacing`);
            
            // CATEGORY: event_date_changes - Log that we're replacing due to different event_id
            logger.logEventDateChange(
              event.id,
              {
                checkinDate: event.start,
                checkoutDate: event.end,
                checkoutType: checkoutType
              },
              `Different event_id for same dates - replacing existing event`,
              {
                uuid: existingEventByDates.uuid,
                oldDates: {
                  checkin: existingEventByDates.checkin_date,
                  checkout: existingEventByDates.checkout_date
                },
                newDates: {
                  checkin: event.start,
                  checkout: event.end
                },
                existingEventId: existingEventByDates.event_id,
                newEventId: event.id,
                sqlOperation: 'UPDATE+INSERT'
              }
            );
            
            // Deactivate the old event
            await supabase
              .from('events')
              .update({ is_active: false })
              .eq('uuid', existingEventByDates.uuid);
            // Mark cleaner assignments as inactive for the old event
            await markCleanerAssignmentsInactiveForEvent(existingEventByDates.uuid);
            
            console.log(`❌ DATABASE UPDATE: Deactivated event ${existingEventByDates.uuid} due to different event_id (${existingEventByDates.event_id} → ${event.id})`);
            
            // Create a new event with the new event_id
            const { error } = await supabase
              .from('events')
              .insert({
                event_id: event.id,
                listing_id: listingId,
                listing_name: finalListingName,
                listing_hours: listingHours,
                checkin_date: event.start,
                checkout_date: event.end,
                checkout_type: checkoutType,
                checkout_time: '10:00:00',
                event_type: 'ical'
              });
              
            if (error) throw error;
            result.replaced++;
            
            console.log(`➕ DATABASE INSERT: Created new event ${event.id} to replace different event_id`);
          }
          // CASE 2: Found by event_id and dates have actually changed
          else if (existingEventById && datesHaveChanged) {
            console.log(`Event ${event.id} - CASE 2: Same event_id but dates changed - replacing`);
            
            // CATEGORY: event_date_changes - Log that we're about to replace due to date changes
            logger.logEventDateChange(
              event.id,
              {
                checkinDate: event.start,
                checkoutDate: event.end,
                checkoutType: checkoutType
              },
              `Event dates changed - deactivating old event and creating new one`,
              {
                uuid: existingEventById.uuid,
                oldDates: {
                  checkin: existingEventById.checkin_date,
                  checkout: existingEventById.checkout_date
                },
                newDates: {
                  checkin: event.start,
                  checkout: event.end
                },
                existingEventId: existingEventById.event_id,
                sqlOperation: 'UPDATE+INSERT'
              }
            );
            
            // Only proceed with modification if this is a new change
            const isNewChange = await logEventChange(
              finalListingName,
              'modified',
              event.id,
              existingEventById,
              event
            );
            
            // Dates changed - deactivate the old event and create a new one
            await supabase
              .from('events')
              .update({ is_active: false })
              .eq('uuid', existingEventById.uuid);
            // Mark cleaner assignments as inactive for the old event
            await markCleanerAssignmentsInactiveForEvent(existingEventById.uuid);
            
            console.log(`❌ DATABASE UPDATE: Deactivated event ${existingEventById.uuid} due to date changes`);
            
            // Create a new event with updated dates
            const { error } = await supabase
              .from('events')
              .insert({
                event_id: event.id,
                listing_id: listingId,
                listing_name: finalListingName,
                listing_hours: listingHours,
                checkin_date: event.start,
                checkout_date: event.end,
                checkout_type: checkoutType,
                checkout_time: '10:00:00',
                event_type: 'ical'
              });
              
            if (error) throw error;
            result.replaced++;
            
            console.log(`➕ DATABASE INSERT: Created new event ${event.id} with updated dates`);
            
            // Only add to modifiedEvents if this is a new change
            if (isNewChange) {
              modifiedEvents.push({
                listing: finalListingName,
                event_id: event.id,
                oldCheckin: existingEventById.checkin_date,
                oldCheckout: existingEventById.checkout_date,
                newCheckin: event.start,
                newCheckout: event.end
              });
            }
          } 
          // CASE 3: Same event, same dates - check checkout type only
          else {
            console.log(`Event ${event.id} - CASE 3: Same event, same dates - checking checkout type`);
            
            // NO date changes - check if checkout_type has changed before updating
            const checkoutTypeChanged = existingEvent.checkout_type !== checkoutType;
            
            console.log(`Event ${event.id} - Checkout type changed:`, checkoutTypeChanged, `(${existingEvent.checkout_type} → ${checkoutType})`);
            
            if (checkoutTypeChanged) {
              // CATEGORY: event_checkout_type_changes - Checkout type has changed
              logger.logEventCheckoutTypeChange(
                event.id,
                {
                  checkinDate: event.start,
                  checkoutDate: event.end,
                  checkoutType: checkoutType
                },
                `Checkout type changed - updating existing event`,
                {
                  uuid: existingEvent.uuid,
                  existingEventId: existingEvent.event_id,
                  oldCheckoutType: existingEvent.checkout_type,
                  newCheckoutType: checkoutType,
                  sqlOperation: 'UPDATE',
                  updatedFields: `checkout_type=${checkoutType}`
                }
              );
              
              // Update the event with new checkout_type only
              const { error } = await supabase
                .from('events')
                .update({
                  checkout_type: checkoutType,
                  updated_at: new Date().toISOString()
                })
                .eq('uuid', existingEvent.uuid);
              
              if (error) throw error;
              result.updated++;
              
              console.log(`🔄 DATABASE UPDATE: Updated event ${existingEvent.uuid} checkout_type: ${existingEvent.checkout_type} → ${checkoutType}`);
            } else {
              // CATEGORY: event_unchanged - Checkout type is the same
              logger.logEventUnchanged(
                event.id,
                {
                  checkinDate: event.start,
                  checkoutDate: event.end,
                  checkoutType: checkoutType
                },
                `No changes needed - checkout type unchanged`,
                {
                  uuid: existingEvent.uuid,
                  existingEventId: existingEvent.event_id,
                  checkoutType: checkoutType
                }
              );
              
              console.log(`✓ NO UPDATE: Event ${existingEvent.uuid} checkout_type already ${checkoutType}`);
              result.unchanged++;
            }
          }
        } else {
          console.log(`Event ${event.id} - CASE 4: New event - checking for overlaps`);
          
          // Check for any event with overlapping dates before inserting
          const { data: overlappingEvents } = await supabase
            .from('events')
            .select('*')
            .eq('listing_name', finalListingName)
            .eq('is_active', true)
            .eq('event_type', 'ical');
          
          const checkOverlap = overlappingEvents ? 
            overlappingEvents.some(existingEvent => {
              // Convert dates to Date objects for comparison
              const eventStart = new Date(event.start);
              const eventEnd = new Date(event.end);
              const existingStart = new Date(existingEvent.checkin_date);
              const existingEnd = new Date(existingEvent.checkout_date);
              
              // Check for date overlap (excluding same day checkout/checkin)
              return (
                (eventStart < existingEnd && eventEnd > existingStart) &&
                !(eventStart.toISOString().split('T')[0] === existingEnd.toISOString().split('T')[0]) // Exclude same day checkout/checkin
              );
            }) : 
            false;
            
          if (checkOverlap) {
            console.log(`Event ${event.id} - Skipping due to overlap`);
            
            // CATEGORY: event_unchanged - Skipping due to overlap
            logger.logEventUnchanged(
              event.id,
              {
                checkinDate: event.start,
                checkoutDate: event.end,
                checkoutType: checkoutType
              },
              `Skipped due to date overlap with existing active event`,
              {
                feedName: 'iCal feed'
              }
            );
            result.unchanged++;
            continue;
          }
          
          console.log(`Event ${event.id} - Creating new event`);
          
          // CATEGORY: event_additions - Insert new event
          const { error } = await supabase
            .from('events')
            .insert({
              event_id: event.id,
              listing_id: listingId,
              listing_name: finalListingName,
              listing_hours: listingHours,
              checkin_date: event.start,
              checkout_date: event.end,
              checkout_type: checkoutType,
              checkout_time: '10:00:00', // Default to 10am
              event_type: 'ical'
            });
            
          if (error) throw error;
          result.added++;
          
          console.log(`➕ DATABASE INSERT: Created completely new event ${event.id}`);
          
          logger.logEventAddition(
            event.id,
            {
              checkinDate: event.start,
              checkoutDate: event.end,
              checkoutType: checkoutType
            },
            `New event added from iCal feed`,
            {
              sqlOperation: 'INSERT',
              feedName: 'iCal feed'
            }
          );
        }
      } catch (error) {
        console.error('Error saving event:', error);
        // Log the error with detailed information
        logger.logEventError(
          event.id,
          {
            checkinDate: event.start,
            checkoutDate: event.end,
            title: event.title
          },
          `Error occurred while processing event: ${error instanceof Error ? error.message : String(error)}`,
          {
            errorDetails: error instanceof Error ? error.message : String(error),
            feedName: 'iCal feed'
          }
        );
        result.errors++;
      }
    }
    
    // Send Slack notification about modified events
    if (modifiedEvents.length > 0) {
      let notificationText = '';
      
      modifiedEvents.forEach(event => {
        notificationText += `Event changed: ${event.listing}, ID: ${event.event_id}\n`;
        notificationText += `OLD:\n`;
        notificationText += `Check-in: ${formatDate(event.oldCheckin)}\n`;
        notificationText += `Check-out: ${formatDate(event.oldCheckout)}\n\n`;
        notificationText += `NEW:\n`;
        notificationText += `Check-in: ${formatDate(event.newCheckin)}\n`;
        notificationText += `Check-out: ${formatDate(event.newCheckout)}\n\n`;
        notificationText += `-------------------\n\n`;
      });
      
      await sendSlackNotification('📅 Booking Changes Detected', notificationText);
    }
    
    // After processing all events (before the return statement)
    // Re-evaluate checkout types for all events since we might have made changes
    await reEvaluateCheckoutTypes(finalListingName, allEvents);
    
    // Include detailed logs in the result
    result.detailedLogs = logger.getLogs();
    
    return result;
  } catch (error) {
    console.error(`Error processing listing ${listingName}:`, error);
    result.errors++;
    result.status = 'error';
    result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

// Function to sync events for a single listing
export async function POST(request: Request) {
  let reportId: string | null = null;
  let dbLogger: SyncDatabaseLogger | null = null;
  let providedSessionId: string | undefined;
  
  try {
    const { listingId, sessionId: providedSessionIdFromRequest } = await request.json();
    providedSessionId = providedSessionIdFromRequest;
    
    if (!listingId) {
      return NextResponse.json({
        success: false,
        error: 'Listing ID is required'
      }, { status: 400 });
    }

    // Extract base URL for API calls - ensure it works in all environments
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const apiBaseUrl = `${protocol}://${host}`;
    
    // Get the specific listing
    const listings = await getListings();
    const listing = listings.find(l => l.id === listingId);
    
    if (!listing) {
      return NextResponse.json({
        success: false,
        error: 'Listing not found'
      }, { status: 404 });
    }
    
    console.log(`Syncing listing: ${listing.name} (${listing.id})`);
    
    // Get the listing details including hours
    const { hours, name } = await getListingHours(listing.id);
    
    // Create or use existing database session
    dbLogger = new SyncDatabaseLogger();
    let actualSessionId: string;
    
    if (providedSessionId) {
      // Use existing session (for "sync all" operations)
      actualSessionId = providedSessionId;
      dbLogger.setSessionId(actualSessionId);
      console.log(`Using existing sync session: ${actualSessionId}`);
    } else {
      // Create new session (for individual syncs)
      actualSessionId = await dbLogger.createSession({
        sync_type: 'single',
        target_listing_id: listing.id,
        target_listing_name: name,
        triggered_by: 'manual', // TODO: could be extracted from request headers/auth
        metadata: {
          apiBaseUrl,
          listingHours: hours
        }
      });
      
      console.log(`Created new sync session: ${actualSessionId}`);
      
      // Start the session only for new sessions
      await dbLogger.startSession();
    }
    
    // Create sync report (keeping existing functionality)
    const syncConfig: SyncConfig = {
      apiBaseUrl,
      dateRange: {
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      },
      activeOnly: true
    };
    
    reportId = await createSyncReport('single', syncConfig, listing.id, name);
    
    // Get all iCal feeds for this listing using the listing_ical_feeds table
    const feeds = await getIcalFeedsForListing(listing.id);
    
    if (!feeds || feeds.length === 0) {
      const errorMessage = `No iCal feeds found for listing ${name} (${listing.id})`;
      
      // Handle session completion differently based on whether it's part of a multi-listing sync
      if (!providedSessionId) {
        // Complete individual session with error
        await dbLogger.completeSession({
          total_events_processed: 0,
          total_feeds_processed: 0,
          total_added: 0,
          total_updated: 0,
          total_deactivated: 0,
          total_replaced: 0,
          total_unchanged: 0,
          total_errors: 1
        }, 'error', errorMessage);
      } else {
        // For multi-listing syncs, just increment the error count
        await dbLogger.incrementStats({
          total_errors: 1
        });
      }
      
      if (reportId) {
        await completeSyncReport(reportId, {
          listingId: listing.id,
          listingName: name,
          feedsProcessed: 0,
          added: 0,
          updated: 0,
          deactivated: 0,
          replaced: 0,
          unchanged: 0,
          errors: 1,
          events: 0,
          status: 'error',
          errorMessage
        }, 'error', errorMessage);
      }
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        sessionId: actualSessionId
      });
    }
    
    console.log(`Found ${feeds.length} feeds for listing ${name} (${listing.id})`);
    
    // Only process active feeds
    const activeFeeds = feeds.filter(feed => feed.is_active);
    
    if (activeFeeds.length === 0) {
      const errorMessage = `No active iCal feeds found for listing ${name} (${listing.id})`;
      
      // Handle session completion differently based on whether it's part of a multi-listing sync
      if (!providedSessionId) {
        // Complete individual session with error
        await dbLogger.completeSession({
          total_events_processed: 0,
          total_feeds_processed: 0,
          total_added: 0,
          total_updated: 0,
          total_deactivated: 0,
          total_replaced: 0,
          total_unchanged: 0,
          total_errors: 1
        }, 'error', errorMessage);
      } else {
        // For multi-listing syncs, just increment the error count
        await dbLogger.incrementStats({
          total_errors: 1
        });
      }
      
      if (reportId) {
        await completeSyncReport(reportId, {
          listingId: listing.id,
          listingName: name,
          feedsProcessed: 0,
          added: 0,
          updated: 0,
          deactivated: 0,
          replaced: 0,
          unchanged: 0,
          errors: 1,
          events: 0,
          status: 'error',
          errorMessage
        }, 'error', errorMessage);
      }
      
      return NextResponse.json({
        success: false,
        error: errorMessage,
        sessionId: actualSessionId
      });
    }
    
    // Process all events for this listing with database logger
    const result = await processListingEvents(listing.id, name, hours, activeFeeds, apiBaseUrl, dbLogger);
    
    // Save detailed logs to database
    if (result.detailedLogs && result.detailedLogs.length > 0) {
      await dbLogger.saveLogEntries(result.detailedLogs);
    }
    
    // Handle session completion differently based on whether it's part of a multi-listing sync
    if (!providedSessionId) {
      // Complete individual session
      await dbLogger.completeSession({
        total_events_processed: result.events,
        total_feeds_processed: result.feedsProcessed,
        total_added: result.added,
        total_updated: result.updated,
        total_deactivated: result.deactivated,
        total_replaced: result.replaced,
        total_unchanged: result.unchanged,
        total_errors: result.errors
      }, result.status === 'success' ? 'completed' : 'error', result.errorMessage);
    } else {
      // For multi-listing syncs, just increment the stats
      await dbLogger.incrementStats({
        total_events_processed: result.events,
        total_feeds_processed: result.feedsProcessed,
        total_added: result.added,
        total_updated: result.updated,
        total_deactivated: result.deactivated,
        total_replaced: result.replaced,
        total_unchanged: result.unchanged,
        total_errors: result.errors
      });
    }
    
    // Complete sync report (keeping existing functionality)
    if (reportId) {
      await completeSyncReport(reportId, {
        listingId: result.listingId,
        listingName: result.listingName,
        feedsProcessed: result.feedsProcessed,
        added: result.added,
        updated: result.updated,
        deactivated: result.deactivated,
        replaced: result.replaced,
        unchanged: result.unchanged,
        errors: result.errors,
        events: result.events,
        status: result.status,
        errorMessage: result.errorMessage,
        detailedLogs: result.detailedLogs
      }, result.status, result.errorMessage);
    }
    
    return NextResponse.json({
      success: result.status === 'success',
      message: result.status === 'success' ? 'Listing synchronized successfully' : 'Listing sync failed',
      result,
      reportId,
      sessionId: actualSessionId,
      error: result.errorMessage
    });
  } catch (error) {
    console.error('Error syncing listing:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Handle database session error
    if (dbLogger) {
      try {
        // Only handle error on the session if it's an individual sync
        // For multi-listing syncs, let the parent sync handle the overall error
        const sessionId = dbLogger.getSessionId();
        if (sessionId && !providedSessionId) {
          await dbLogger.handleError(error instanceof Error ? error : new Error(errorMessage));
        }
      } catch (dbError) {
        console.error('Failed to update database session with error:', dbError);
      }
    }
    
    // Complete sync report with error (keeping existing functionality)
    if (reportId) {
      await completeSyncReport(reportId, {
        listingId: '',
        listingName: '',
        feedsProcessed: 0,
        added: 0,
        updated: 0,
        deactivated: 0,
        replaced: 0,
        unchanged: 0,
        errors: 1,
        events: 0,
        status: 'error',
        errorMessage
      }, 'error', errorMessage, { error: error instanceof Error ? error.stack : String(error) });
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      reportId,
      sessionId: dbLogger?.getSessionId()
    }, { status: 500 });
  }
}