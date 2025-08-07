import { supabase } from './supabase';
import { 
  createEventFingerprint,
  createCalendarEventVersion,
  createSyncStatus,
  updateSyncStatus,
  updateAffectedCleanerAssignments
} from './calendar-models';
import { getListings, getIcalFeeds, getIcalFeedsForListing } from './models';

interface SyncStats {
  listingsProcessed: number;
  feedsProcessed: number;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeactivated: number;
  eventsVersioned: number;
}

/**
 * Synchronize calendar events from iCal feeds for all listings
 */
export const syncCalendarEvents = async (baseUrl?: string, startDate?: string, endDate?: string) => {
  // If no baseUrl is provided, try to determine it
  const apiBaseUrl = baseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

  // Calculate default date range if not provided
  // Default to 3 months in the past and 6 months in the future
  if (!startDate) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    startDate = threeMonthsAgo.toISOString();
  }
  
  if (!endDate) {
    const sixMonthsAhead = new Date();
    sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
    endDate = sixMonthsAhead.toISOString();
  }
  
  console.log(`Starting calendar sync from ${startDate} to ${endDate}`);
  
  // Initialize sync counters
  const stats: SyncStats = {
    listingsProcessed: 0,
    feedsProcessed: 0,
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeactivated: 0,
    eventsVersioned: 0
  };
  
  const syncTime = new Date().toISOString();
  
  // Create a sync record to track this operation
  const { data: syncRecord, error: syncError } = await supabase
    .from('sync_history')
    .insert({
      sync_time: syncTime,
      listings_added: 0,
      listings_removed: 0,
      events_added: 0,
      events_updated: 0,
      events_deactivated: 0
    })
    .select();
  
  if (syncError || !syncRecord) {
    throw new Error(`Failed to create sync history record: ${syncError?.message || 'No data returned'}`);
  }
  
  const syncId = syncRecord[0].id;
  
  // Create a sync status record
  const syncStatus = await createSyncStatus('running');
  console.log(`Created sync status with ID: ${syncStatus.id}`);
  
  try {
    // Count active events before sync
    const { count: activeEventsBefore } = await supabase
      .from('calendar_events')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    
    console.log(`Before sync: ${activeEventsBefore || 0} active events in database`);
    
    // Get all listings to process
    const listings = await getListings();
    console.log(`Found ${listings.length} listings to process`);
    
    // Filter out manual listings (those with external_id starting with 'manual-')
    const syncableListings = listings.filter(listing => 
      !listing.external_id?.startsWith('manual-')
    );
    
    console.log(`Filtered to ${syncableListings.length} syncable listings (excluded ${listings.length - syncableListings.length} manual listings)`);
    
    // Process listings in batches of 5 to avoid overwhelming the system
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < syncableListings.length; i += BATCH_SIZE) {
      const batch = syncableListings.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch of ${batch.length} listings (${i+1} to ${Math.min(i+BATCH_SIZE, syncableListings.length)} of ${syncableListings.length})`);
      
      // Process listings in parallel (but in controlled batches)
      const results = await Promise.all(batch.map(listing => processListing(
        listing, 
        apiBaseUrl, 
        syncTime, 
        syncId,
        startDate!, 
        endDate!
      )));
      
      // Collect stats from this batch
      results.forEach(result => {
        stats.listingsProcessed++;
        stats.feedsProcessed += result.feedsProcessed;
        stats.eventsAdded += result.eventsAdded;
        stats.eventsUpdated += result.eventsUpdated;
        stats.eventsDeactivated += result.eventsDeactivated;
        stats.eventsVersioned += result.eventsVersioned;
      });
      
      console.log(`Completed batch. Progress: ${stats.listingsProcessed}/${syncableListings.length} listings processed`);
    }
    
    // Count active events after sync
    const { count: activeEventsAfter } = await supabase
      .from('calendar_events')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    
    console.log(`After sync: ${activeEventsAfter || 0} active events in database (changed by ${(activeEventsAfter || 0) - (activeEventsBefore || 0)})`);
    
    // Update sync history with final counts
    await supabase
      .from('sync_history')
      .update({
        events_added: stats.eventsAdded,
        events_updated: stats.eventsUpdated,
        events_deactivated: stats.eventsDeactivated
      })
      .eq('id', syncId);
    
    // Update sync status to completed
    await updateSyncStatus(syncStatus.id, 'completed');
    
    console.log(`Sync completed: ${stats.listingsProcessed} listings, ${stats.feedsProcessed} feeds, +${stats.eventsAdded} events, ${stats.eventsUpdated} updated, ${stats.eventsDeactivated} deactivated, ${stats.eventsVersioned} versioned`);
    
    return stats;
  } catch (error) {
    console.error('Sync failed:', error);
    
    // Update sync status to failed
    await updateSyncStatus(
      syncStatus.id, 
      'failed', 
      error instanceof Error ? error.message : String(error)
    );
    
    throw error;
  }
};

/**
 * Process a single listing and its iCal feeds
 */
async function processListing(
  listing: any, 
  apiBaseUrl: string, 
  syncTime: string,
  syncId: string,
  startDate: string,
  endDate: string
) {
  const result = {
    listingId: listing.id,
    feedsProcessed: 0,
    eventsFound: 0,
    activeEventIds: [] as string[],
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsVersioned: 0,
    eventsDeactivated: 0,
  };
  
  try {
    console.log(`Processing listing: ${listing.name} (${listing.id})`);
    
    // Get all iCal feeds for this listing
    const icalFeeds = await getIcalFeedsForListing(listing.id);
    
    if (icalFeeds.length === 0) {
      console.log(`No iCal feeds found for listing ${listing.name}`);
      return result;
    }
    
    console.log(`Found ${icalFeeds.length} feeds for listing ${listing.name}`);
    
    // Process active feeds in parallel
    const feedResults = await Promise.all(
      icalFeeds.filter(feed => feed.is_active).map(feed => processFeed(
        feed,
        listing,
        apiBaseUrl,
        syncTime,
        syncId,
        startDate,
        endDate
      ))
    );
    
    // Collect results from all feeds
    feedResults.forEach(feedResult => {
      result.feedsProcessed++;
      result.eventsFound += feedResult.eventsFound;
      result.activeEventIds.push(...feedResult.eventIds);
      result.eventsAdded += feedResult.eventsAdded;
      result.eventsUpdated += feedResult.eventsUpdated;
      result.eventsVersioned += feedResult.eventsVersioned;
    });
    
    console.log(`Completed processing all feeds for listing ${listing.name}, found ${result.eventsFound} events with ${result.activeEventIds.length} active IDs`);
    
    // Safeguard: If we didn't find any events but feeds were processed successfully,
    // skip deactivation to prevent wiping out all events
    if (result.activeEventIds.length === 0 && result.feedsProcessed > 0) {
      console.warn(`No active event IDs collected for listing ${listing.name} despite successful feed processing. Skipping deactivation to prevent data loss.`);
    } 
    // Only proceed with deactivation if we have active event IDs
    else if (result.activeEventIds.length > 0) {
      const deactivatedCount = await deactivateStaleEvents(
        listing.id,
        result.activeEventIds,
        syncTime,
        syncId
      );
      
      result.eventsDeactivated = deactivatedCount;
      result.eventsVersioned += deactivatedCount; // Each deactivation creates a version
      
      console.log(`Deactivated ${deactivatedCount} stale events for listing ${listing.name}`);
    } else {
      console.warn(`No active events found for listing ${listing.name}, skipping deactivation step`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error processing listing ${listing.id}:`, error);
    return result;
  }
}

/**
 * Process a single iCal feed
 */
async function processFeed(
  feed: any,
  listing: any,
  apiBaseUrl: string,
  syncTime: string,
  syncId: string,
  startDate: string,
  endDate: string
) {
  const result = {
    feedId: feed.id,
    eventsFound: 0,
    eventIds: [] as string[],
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsVersioned: 0
  };
  
  try {
    console.log(`Processing feed: ${feed.name} (${feed.id})`);
    
    // Fetch events from the iCal feed
    const response = await fetch(`${apiBaseUrl}/api/fetch-ical`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: feed.url,
        listingId: listing.id,
        startDate,
        endDate
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Failed to fetch iCal data for ${feed.name}:`, errorData.error);
      return result;
    }
    
    const data = await response.json();
    console.log(`Received ${data.events.length} events from feed ${feed.name}`);
    result.eventsFound = data.events.length;
    
    // Process each booking event into check-in and check-out events
    for (const event of data.events) {
      const startTime = new Date(event.start);
      const endTime = new Date(event.end);
      
      // Extract guest name from title if available
      const guestName = event.title.split(' - ')[0] || null;
      
      // Determine if this is a same-day checkout
      // The current logic is incorrect - same day checkout is when a new guest checks in on the same day as a checkout
      // We need to look for other events with start date matching this event's end date
      // For now, we'll fix the basic check - startTime and endTime are on the same day
      // This is incorrect because it has nothing to do with bookings back-to-back
      // const isSameDayCheckout = startTime.toDateString() === endTime.toDateString();
      
      // Proper fix: we need to check if there are any other events in this listing
      // where the start time is the same day as this event's end time
      // Find other events with check-in on the same day as this event's checkout
      const sameEndDateEvents = data.events.filter((otherEvent: any) => {
        if (otherEvent === event) return false; // Skip comparing with self
        
        const otherStartTime = new Date(otherEvent.start);
        return endTime.toDateString() === otherStartTime.toDateString();
      });
      
      const isSameDayCheckout = sameEndDateEvents.length > 0;
      
      // Create event IDs for check-in and check-out
      const checkInEventId = `checkin-${event.id}`;
      const checkOutEventId = `checkout-${event.id}`;
      
      // Add to active event IDs list
      result.eventIds.push(checkInEventId, checkOutEventId);
      
      // Process check-in event
      const checkInResult = await processCalendarEvent({
        event_uid: checkInEventId,
        listing_id: listing.id,
        feed_id: feed.id,
        title: `Check-in: ${event.title}`,
        start_time: startTime.toISOString(),
        end_time: startTime.toISOString(),
        is_check_in: true,
        is_check_out: false,
        is_same_day_checkout: isSameDayCheckout,
        checkout_time: '10:00:00', // Default checkout time
        guest_name: guestName,
        syncTime,
        syncId
      });
      
      if (checkInResult.added) result.eventsAdded++;
      if (checkInResult.updated) result.eventsUpdated++;
      if (checkInResult.versioned) result.eventsVersioned++;
      
      // Process check-out event
      const checkOutResult = await processCalendarEvent({
        event_uid: checkOutEventId,
        listing_id: listing.id,
        feed_id: feed.id,
        title: `Check-out: ${event.title}`,
        start_time: endTime.toISOString(),
        end_time: endTime.toISOString(),
        is_check_in: false,
        is_check_out: true,
        is_same_day_checkout: isSameDayCheckout,
        checkout_time: '10:00:00', // Default checkout time
        guest_name: guestName,
        syncTime,
        syncId
      });
      
      if (checkOutResult.added) result.eventsAdded++;
      if (checkOutResult.updated) result.eventsUpdated++;
      if (checkOutResult.versioned) result.eventsVersioned++;
    }
    
    // Update last synced time for this feed
    await supabase
      .from('ical_feeds')
      .update({ last_synced: syncTime })
      .eq('id', feed.id);
    
    return result;
  } catch (error) {
    console.error(`Error processing feed ${feed.id}:`, error);
    return result;
  }
}

/**
 * Process a single calendar event (create or update)
 */
async function processCalendarEvent(eventData: {
  event_uid: string;
  listing_id: string;
  feed_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_check_in: boolean;
  is_check_out: boolean;
  is_same_day_checkout: boolean;
  checkout_time: string;
  guest_name: string | null;
  syncTime: string;
  syncId: string;
}): Promise<{ added: boolean; updated: boolean; versioned: boolean }> {
  try {
    // Generate fingerprint for change detection
    const fingerprint = createEventFingerprint({
      start_time: eventData.start_time,
      end_time: eventData.end_time,
      title: eventData.title,
      guest_name: eventData.guest_name
    });
    
    // Try to find existing event
    const { data: existingEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('event_uid', eventData.event_uid);
    
    if (existingEvents && existingEvents.length > 0) {
      const existingEvent = existingEvents[0];
      const existingFingerprint = existingEvent.event_fingerprint;
      
      // Check if the event has changed by comparing fingerprints
      if (existingFingerprint !== fingerprint) {
        // Event has changed (moved or details updated)
        
        // Create a version record before updating
        await createCalendarEventVersion(
          existingEvent.id,
          existingEvent.version_number,
          existingEvent.start_time,
          existingEvent.end_time,
          'moved', // Either moved dates or details changed
          eventData.syncId
        );
        
        // Update the event with new data
        await supabase
          .from('calendar_events')
          .update({
            title: eventData.title,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            is_check_in: eventData.is_check_in,
            is_check_out: eventData.is_check_out,
            is_same_day_checkout: eventData.is_same_day_checkout,
            guest_name: eventData.guest_name,
            event_fingerprint: fingerprint,
            version_number: existingEvent.version_number + 1,
            last_synced: eventData.syncTime,
            is_active: true, // Ensure it's active
            updated_at: new Date().toISOString()
          })
          .eq('id', existingEvent.id);
        
        // Update any affected cleaner assignments
        await updateAffectedCleanerAssignments(
          existingEvent.id,
          eventData.start_time,
          eventData.end_time
        );
        
        // Also reactivate any cleaner assignments for this event
        await supabase
          .from('cleaner_event_assignments')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('event_id', existingEvent.id);
        
        return { added: false, updated: true, versioned: true };
      } else {
        // Event hasn't changed, just update last_synced
        await supabase
          .from('calendar_events')
          .update({
            last_synced: eventData.syncTime,
            is_active: true // Ensure it's active in case it was previously deactivated
          })
          .eq('id', existingEvent.id);
        
        // Ensure cleaner assignments are active for this event
        await supabase
          .from('cleaner_event_assignments')
          .update({ 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('event_id', existingEvent.id);
        
        return { added: false, updated: false, versioned: false };
      }
    } else {
      // This is a new event
      await supabase
        .from('calendar_events')
        .insert({
          event_uid: eventData.event_uid,
          listing_id: eventData.listing_id,
          feed_id: eventData.feed_id,
          title: eventData.title,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          is_check_in: eventData.is_check_in,
          is_check_out: eventData.is_check_out,
          is_same_day_checkout: eventData.is_same_day_checkout,
          checkout_time: eventData.checkout_time,
          guest_name: eventData.guest_name,
          is_active: true,
          event_fingerprint: fingerprint,
          version_number: 1,
          last_synced: eventData.syncTime
        });
      
      return { added: true, updated: false, versioned: false };
    }
  } catch (error) {
    console.error(`Error processing calendar event ${eventData.event_uid}:`, error);
    throw error;
  }
}

/**
 * Deactivate events that are no longer in the feeds
 */
async function deactivateStaleEvents(
  listingId: string,
  activeEventIds: string[],
  syncTime: string,
  syncId: string
): Promise<number> {
  // Safety check: if no active event IDs provided, don't deactivate anything
  if (!activeEventIds || activeEventIds.length === 0) {
    console.warn(`No active events provided for listing ${listingId}, skipping deactivation step`);
    return 0;
  }
  
  try {
    // Prepare proper SQL list format for the not-in query
    const eventIdsForQuery = activeEventIds.map(id => `'${id}'`).join(',');
    
    // Additional safety check - if we couldn't build a proper list, abort
    if (!eventIdsForQuery || eventIdsForQuery.length === 0) {
      console.warn(`Failed to build event ID list for listing ${listingId}, skipping deactivation`);
      return 0;
    }
    
    console.log(`Checking for stale events in listing ${listingId} against ${activeEventIds.length} active events`);
    
    // Find events that weren't updated in this sync (stale events)
    const { data: staleEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_active', true)
      .lt('last_synced', syncTime)
      .not('event_uid', 'in', `(${eventIdsForQuery})`);
    
    if (!staleEvents || staleEvents.length === 0) return 0;
    
    console.log(`Found ${staleEvents.length} stale events to deactivate for listing ${listingId}`);
    
    // Process each stale event
    for (const event of staleEvents) {
      // Create a version record for the cancellation
      await createCalendarEventVersion(
        event.id,
        event.version_number,
        event.start_time,
        event.end_time,
        'canceled',
        syncId
      );
      
      // Mark the event as inactive and increment version
      await supabase
        .from('calendar_events')
        .update({
          is_active: false,
          version_number: event.version_number + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', event.id);
      
      // Mark cleaner assignments as inactive, but preserve the assignment data
      // Get existing assignments first
      const { data: existingAssignments } = await supabase
        .from('cleaner_event_assignments')
        .select('id')
        .eq('event_id', event.id)
        .eq('is_active', true);
        
      // If there are assignments, deactivate them but preserve the data
      if (existingAssignments && existingAssignments.length > 0) {
        console.log(`Event ${event.id} has ${existingAssignments.length} cleaner assignments to deactivate`);
        
        await supabase
          .from('cleaner_event_assignments')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('event_id', event.id);
      }
    }
    
    return staleEvents.length;
  } catch (error) {
    console.error(`Error deactivating stale events for listing ${listingId}:`, error);
    throw error;
  }
}

/**
 * Reactivate future events that may have been incorrectly marked as inactive
 */
export const reactivateFutureEvents = async () => {
  console.log('Reactivating future events that may have been incorrectly marked as inactive...');
  
  try {
    // Find all inactive events with future dates
    const { data: inactiveEvents, error } = await supabase
      .from('calendar_events')
      .select('id, event_uid, start_time, end_time')
      .eq('is_active', false)
      .gt('start_time', new Date().toISOString());
    
    if (error) {
      throw error;
    }
    
    if (!inactiveEvents || inactiveEvents.length === 0) {
      console.log('No inactive future events found that need reactivation');
      return { reactivated: 0 };
    }
    
    console.log(`Found ${inactiveEvents.length} inactive future events to reactivate`);
    
    // Reactivate them all
    const { error: updateError } = await supabase
      .from('calendar_events')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .in('id', inactiveEvents.map(event => event.id));
    
    if (updateError) {
      throw updateError;
    }
    
    // Also reactivate any associated cleaner assignments
    if (inactiveEvents.length > 0) {
      const { error: assignmentError } = await supabase
        .from('cleaner_event_assignments')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .in('event_id', inactiveEvents.map(event => event.id));
      
      if (assignmentError) {
        console.log('Warning: Could not reactivate associated cleaner assignments:', assignmentError);
      } else {
        console.log(`Reactivated cleaner assignments for ${inactiveEvents.length} events`);
      }
    }
    
    console.log(`Successfully reactivated ${inactiveEvents.length} future events`);
    return { reactivated: inactiveEvents.length };
  } catch (error) {
    console.error('Error reactivating future events:', error);
    throw error;
  }
}; 