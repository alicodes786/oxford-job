import { supabase } from './supabase';

export interface Listing {
  id: string;
  external_id: string;
  name: string;
  color: string | null;
  hours: number;
  bank_account: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IcalFeed {
  id: string;
  external_id: string;
  url: string;
  name: string;
  last_synced: string | null;
  is_active: boolean;
  color: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BookingEvent {
  id: string;
  listing_id: string;
  ical_feed_id: string;
  event_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_check_in: boolean;
  is_check_out: boolean;
  is_same_day_checkout: boolean;
  guest_name: string | null;
  is_active: boolean;
  last_synced: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListingIcalFeed {
  id: string;
  listing_id: string;
  ical_feed_id: string;
  created_at?: string;
}

export interface SyncHistory {
  id: string;
  sync_time: string;
  listings_added: number;
  listings_removed: number;
  events_added: number;
  events_updated: number;
  events_deactivated: number;
  created_at?: string;
}

export interface Cleaner {
  id: string;
  name: string;
  hourly_rate: number;
  password?: string;
  external_id?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  role?: string;
  uuid?: string;
}

export interface CleanerAssignment {
  uuid: string;
  cleaner_uuid: string;
  event_uuid: string;
  hours: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CleanerAssignmentOptions {
  cleanerUuid?: string;
  eventUuid?: string;
  isActive?: boolean;
  includeEvent?: boolean;
  includeCleaner?: boolean;
  orderBy?: {
    column: string;
    ascending: boolean;
  };
}

// Listings
export const getListings = async (forceReload?: boolean) => {
  const { data, error } = await supabase
    .from('listings')
    .select('*');
  
  if (error) throw error;
  return data;
};

export const createListing = async (listing: Omit<Partial<Listing>, 'id' | 'created_at' | 'updated_at'>, icalUrls?: string[]) => {
  // Ensure required fields are present
  if (!listing.name || !listing.external_id) {
    throw new Error('Listing name and external_id are required');
  }

  // Set defaults for optional fields
  const listingToCreate = {
    name: listing.name,
    external_id: listing.external_id,
    color: listing.color || null,
    hours: listing.hours || 2.0,
    bank_account: listing.bank_account
  };
  
  // Create the listing
  const { data, error } = await supabase
    .from('listings')
    .insert(listingToCreate)
    .select();
  
  if (error) throw error;
  
  // If we have iCal URLs, create feeds and associations
  if (icalUrls && icalUrls.length > 0) {
    for (const url of icalUrls) {
      // Create a feed
      const externalId = `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const feedData = {
        external_id: externalId,
        url,
        name: listing.name,
        is_active: true,
        color: listing.color || null,
        last_synced: null
      };
      
      // Create the feed and associate it with this listing
      await createIcalFeed(feedData, data[0].id);
    }
  }
  
  return data[0];
};

export const updateListing = async (id: string, updates: Partial<Omit<Listing, 'id' | 'created_at' | 'updated_at'>>) => {
  const { data, error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteListing = async (id: string) => {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// iCal Feeds
export const getIcalFeeds = async () => {
  const { data, error } = await supabase
    .from('ical_feeds')
    .select('*');
  
  if (error) throw error;
  return data;
};

// Function to get iCal feeds for a specific listing
export const getIcalFeedsForListing = async (listingId: string): Promise<IcalFeed[]> => {
  // First get the association IDs
  const { data: associations, error: assocError } = await supabase
    .from('listing_ical_feeds')
    .select('ical_feed_id')
    .eq('listing_id', listingId);
  
  if (assocError) throw assocError;
  if (!associations || associations.length === 0) return [];
  
  // Then get the actual feeds
  const feedIds = associations.map(assoc => assoc.ical_feed_id);
  const { data: feeds, error: feedsError } = await supabase
    .from('ical_feeds')
    .select('*')
    .in('id', feedIds);
  
  if (feedsError) throw feedsError;
  return feeds || [];
};

// Add a function to associate an iCal feed with a listing
export const associateIcalFeedWithListing = async (listingId: string, icalFeedId: string) => {
  const { data, error } = await supabase
    .from('listing_ical_feeds')
    .insert({
      listing_id: listingId,
      ical_feed_id: icalFeedId
    })
    .select();
  
  if (error) throw error;
  return data[0];
};

export const createIcalFeed = async (feed: Omit<IcalFeed, 'id' | 'created_at' | 'updated_at'>, listingId?: string) => {
  // Start a transaction by creating the ical feed first
  const { data: icalData, error: icalError } = await supabase
    .from('ical_feeds')
    .insert(feed)
    .select();
  
  if (icalError) throw icalError;

  // If a listing ID is provided, associate the feed with that listing
  if (listingId) {
    try {
      await associateIcalFeedWithListing(listingId, icalData[0].id);
    } catch (error) {
      console.error("Error associating feed with listing:", error);
    }
  } else {
    // Auto-create a new listing if no existing listing ID is provided
    try {
      const listingData = {
        external_id: `listing-${feed.external_id}`,
        name: feed.name,
        color: feed.is_active ? feed.color : null,
        hours: 2.0
      };

      const { data: newListing, error } = await supabase
        .from('listings')
        .insert(listingData)
        .select();
      
      if (error) throw error;
      
      // Associate the new listing with the ical feed
      await associateIcalFeedWithListing(newListing[0].id, icalData[0].id);
    } catch (error) {
      console.error("Error creating matching listing:", error);
      // We don't throw here to avoid interrupting the main flow
      // The migration tool can fix this later if needed
    }
  }
  
  return icalData[0];
};

export const updateIcalFeed = async (id: string, updates: Partial<Omit<IcalFeed, 'id' | 'created_at' | 'updated_at'>>) => {
  // First update the ical feed
  const { data: icalData, error: icalError } = await supabase
    .from('ical_feeds')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (icalError) throw icalError;

  // Get associated listings for this feed
  try {
    const { data: associations } = await supabase
      .from('listing_ical_feeds')
      .select('listing_id')
      .eq('ical_feed_id', id);
    
    if (associations && associations.length > 0) {
      // Update the corresponding listings with the relevant fields
      const listingIdsToUpdate = associations.map(assoc => assoc.listing_id);
      
      for (const listingId of listingIdsToUpdate) {
        const listingUpdates: any = {};
        
        if (updates.name) listingUpdates.name = updates.name;
        if (updates.url) listingUpdates.ical_url = updates.url;
        if (updates.color || updates.is_active !== undefined) {
          listingUpdates.color = updates.is_active === false ? null : (updates.color || icalData[0].color);
        }
        
        // Only update if we have changes to make
        if (Object.keys(listingUpdates).length > 0) {
          await supabase
            .from('listings')
            .update(listingUpdates)
            .eq('id', listingId);
        }
      }
    }
  } catch (error) {
    console.error("Error updating matching listings:", error);
    // We don't throw here to avoid interrupting the main flow
  }
  
  return icalData[0];
};

export const deleteIcalFeed = async (id: string, deleteMatchingListing = false) => {
  // If requested, also delete the matching listing
  if (deleteMatchingListing) {
    try {
      // Find any listings associated with this feed
      const { data: associations } = await supabase
        .from('listing_ical_feeds')
        .select('listing_id')
        .eq('ical_feed_id', id);
      
      if (associations && associations.length > 0) {
        // Delete the corresponding listings
        for (const assoc of associations) {
          await supabase
            .from('listings')
            .delete()
            .eq('id', assoc.listing_id);
        }
      }
    } catch (error) {
      console.error("Error deleting matching listings:", error);
      // We don't throw here to avoid interrupting the main flow
    }
  }
  
  // Delete the feed (will automatically delete associations due to foreign key constraints)
  const { error } = await supabase
    .from('ical_feeds')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Booking Events
export const getBookingEventsByDateRange = async (
  startDate: string, 
  endDate: string,
  listingId?: string,
  includeInactive: boolean = false,
  versionNumber?: number
) => {
  // Start building the query
  let query = supabase
    .from('booking_events')
    .select('*, listing:listing_id(name, color)')
    .gte('start_time', startDate)
    .lte('end_time', endDate);
  
  // Apply additional filters
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }
  
  if (listingId) {
    query = query.eq('listing_id', listingId);
  }
  
  if (versionNumber !== undefined) {
    query = query.eq('version_number', versionNumber);
  }
  
  // Execute the query
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Transform the data to match your existing calendar events format
  return data.map(event => ({
    id: event.event_id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    listing: event.listing?.name,
    listingId: event.listing_id,
    color: event.listing?.color,
    isCheckIn: event.is_check_in,
    isCheckOut: event.is_check_out,
    isSameDayCheckout: event.is_same_day_checkout,
    guestName: event.guest_name,
    isActive: event.is_active,
    version: event.version_number
  }));
};

// Get booking events for a specific listing within a date range
export const getBookingEventsForListing = async (listingId: string, startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('booking_events')
    .select('*, listing:listing_id(name, color)')
    .eq('listing_id', listingId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)
    .eq('is_active', true);
  
  if (error) throw error;
  
  // Transform the data to match your existing calendar events format
  return data.map(event => ({
    id: event.event_id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    listing: event.listing?.name,
    listingId: event.listing_id,
    color: event.listing?.color,
    isCheckIn: event.is_check_in,
    isCheckOut: event.is_check_out,
    isSameDayCheckout: event.is_same_day_checkout,
    guestName: event.guest_name
  }));
};

// New function to get booking event versions
export const getBookingEventVersions = async (bookingEventId: string) => {
  const { data, error } = await supabase
    .from('booking_event_versions')
    .select('*')
    .eq('booking_event_id', bookingEventId)
    .order('version_number', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Create a version record for a booking event
export const createBookingEventVersion = async (
  bookingEventId: string,
  versionNumber: number,
  previousStartTime: string,
  previousEndTime: string,
  changeType: 'created' | 'moved' | 'canceled',
  syncId?: string
) => {
  const { data, error } = await supabase
    .from('booking_event_versions')
    .insert({
      booking_event_id: bookingEventId,
      version_number: versionNumber,
      previous_start_time: previousStartTime,
      previous_end_time: previousEndTime,
      change_type: changeType,
      sync_id: syncId
    })
    .select();
  
  if (error) throw error;
  return data[0];
};

// Increment the version number of an event
export const incrementEventVersion = async (id: string, currentVersion: number) => {
  const { data, error } = await supabase
    .from('booking_events')
    .update({ version_number: currentVersion + 1 })
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Create an event fingerprint for change detection
export const createEventFingerprint = (event: {
  start_time: string;
  end_time: string;
  title: string;
  guest_name?: string | null;
}) => {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(`${event.start_time}${event.end_time}${event.title}${event.guest_name || ''}`)
    .digest('hex');
};

// New function to track sync status
export const createSyncStatus = async (status: 'idle' | 'running' | 'completed' | 'failed', errorMessage?: string) => {
  const { data, error } = await supabase
    .from('sync_status')
    .insert({
      status,
      error_message: errorMessage
    })
    .select();
  
  if (error) throw error;
  return data[0];
};

// Update sync status
export const updateSyncStatus = async (id: string, status: 'idle' | 'running' | 'completed' | 'failed', errorMessage?: string) => {
  const { data, error } = await supabase
    .from('sync_status')
    .update({
      status,
      error_message: errorMessage,
      last_sync_time: new Date().toISOString()
    })
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Get latest sync status
export const getLatestSyncStatus = async () => {
  const { data, error } = await supabase
    .from('sync_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  return data[0];
};

// Helper function to process a booking event (create or update)
const processBookingEvent = async (
  eventData: {
    listing_id: string;
    ical_feed_id: string;
    event_id: string;
    title: string;
    start_time: string;
    end_time: string;
    is_check_in: boolean;
    is_check_out: boolean;
    is_same_day_checkout: boolean;
    guest_name: string | null;
    is_active: boolean;
    last_synced: string;
    event_fingerprint: string;
  }, 
  counters: {
    eventsAdded: number;
    eventsUpdated: number;
    eventsVersioned: number;
  },
  syncId?: string
): Promise<{ added: boolean; updated: boolean; versioned: boolean }> => {
  // Try to find existing event
  const { data: existingEvents } = await supabase
    .from('booking_events')
    .select('*')
    .eq('listing_id', eventData.listing_id)
    .eq('event_id', eventData.event_id);
    
  if (existingEvents && existingEvents.length > 0) {
    const existingEvent = existingEvents[0];
    const existingFingerprint = existingEvent.event_fingerprint;
    
    // Check if the event has changed by comparing fingerprints
    if (existingFingerprint !== eventData.event_fingerprint) {
      // Create a version record before updating
      await createBookingEventVersion(
        existingEvent.id,
        existingEvent.version_number,
        existingEvent.start_time,
        existingEvent.end_time,
        'moved', // Since dates/details changed
        syncId
      );
      
      // Update existing event with new data and increment version
      await supabase
        .from('booking_events')
        .update({
          ...eventData,
          version_number: existingEvent.version_number + 1,
          is_active: true // Ensure it's active
        })
        .eq('id', existingEvent.id);
      
      counters.eventsUpdated += 1;
      counters.eventsVersioned += 1;
      
      // Update any affected cleaner assignments
      await updateAffectedCleanerAssignments(existingEvent.id, eventData.start_time, eventData.end_time);
      
      return { added: false, updated: true, versioned: true };
    } else {
      // Just update the last_synced timestamp if nothing else changed
      await supabase
        .from('booking_events')
        .update({ 
          last_synced: eventData.last_synced,
          is_active: true // Ensure it's active in case it was previously marked inactive
        })
        .eq('id', existingEvent.id);
      
      // No counter increment needed as this isn't a meaningful update
      return { added: false, updated: false, versioned: false };
    }
  } else {
    // Insert new event with version 1
    const { data: newEvent } = await supabase
      .from('booking_events')
      .insert({
        ...eventData,
        version_number: 1
      })
      .select();
      
    counters.eventsAdded += 1;
    
    // No version record needed for first version
    return { added: true, updated: false, versioned: false };
  }
};

// Update cleaner assignments when an event changes
const updateAffectedCleanerAssignments = async (eventId: string, newStartTime: string, newEndTime: string) => {
  // Find all cleaner assignments for this event
  const { data: assignments } = await supabase
    .from('cleaner_assignments')
    .select('*')
    .eq('event_id', eventId);
  
  if (!assignments || assignments.length === 0) return;
  
  // Update each assignment based on event type (check-in or check-out)
  for (const assignment of assignments) {
    const eventDate = assignment.event_id.startsWith('checkin-') ? newStartTime : newEndTime;
    
    await supabase
      .from('cleaner_assignments')
      .update({ assignment_date: eventDate })
      .eq('id', assignment.id);
  }
  
  return assignments.length;
};

// Mark events as inactive if they're no longer in the feed
const deactivateStaleEvents = async (
  listingId: string, 
  activeEventIds: string[], 
  syncTime: string,
  counters: {
    eventsDeactivated: number;
    eventsVersioned: number;
  },
  syncId?: string
): Promise<number> => {
  // Safety check: if no active event IDs provided, don't deactivate anything
  if (!activeEventIds || activeEventIds.length === 0) {
    console.warn(`No active events provided for listing ${listingId}, skipping deactivation step`);
    return 0;
  }

  console.log(`Checking for stale events for listing ${listingId}, have ${activeEventIds.length} active events`);
  
  // SAFETY MECHANISM: For SQL query performance and to avoid potential issues,
  // if we have too many active events, we'll use a different approach
  if (activeEventIds.length > 1000) {
    console.log(`Too many active events (${activeEventIds.length}) to use in a single query, using batched approach`);
    // Instead of NOT IN, we'll get all active events and filter in code
    const { data: allActiveEvents } = await supabase
      .from('booking_events')
      .select('*')
      .eq('listing_id', listingId)
      .eq('is_active', true)
      .lt('last_synced', new Date().toISOString());
    
    if (!allActiveEvents || allActiveEvents.length === 0) return 0;
    
    // Create a Set of active event IDs for O(1) lookups
    const activeEventIdSet = new Set(activeEventIds);
    
    // Find events that are not in our active set
    const staleEvents = allActiveEvents.filter(event => !activeEventIdSet.has(event.event_id));
    
    console.log(`Found ${staleEvents.length} stale events to deactivate for listing ${listingId}`);
    
    // Process stale events as usual
    for (const event of staleEvents) {
      await createBookingEventVersion(
        event.id,
        event.version_number,
        event.start_time,
        event.end_time,
        'canceled',
        syncId
      );
      
      await supabase
        .from('booking_events')
        .update({ 
          is_active: false,
          version_number: event.version_number + 1
        })
        .eq('id', event.id);
      
      await supabase
        .from('cleaner_assignments')
        .update({ is_active: false })
        .eq('event_id', event.event_id);
      
      counters.eventsDeactivated += 1;
      counters.eventsVersioned += 1;
    }
    
    return staleEvents.length;
  }
  
  // Standard approach for smaller sets of active events
  // Find events that weren't updated in this sync
  const { data: staleEvents } = await supabase
    .from('booking_events')
    .select('*')
    .eq('listing_id', listingId)
    .eq('is_active', true)
    .lt('last_synced', new Date().toISOString())
    .not('event_id', 'in', `(${activeEventIds.join(',')})`);
  
  if (!staleEvents || staleEvents.length === 0) return 0;
  
  console.log(`Found ${staleEvents.length} stale events to deactivate for listing ${listingId}`);
  
  // Create version records and deactivate each stale event
  for (const event of staleEvents) {
    // Create a version record for the cancellation
    await createBookingEventVersion(
      event.id,
      event.version_number,
      event.start_time,
      event.end_time,
      'canceled',
      syncId
    );
    
    // Mark the event as inactive and increment version
    await supabase
      .from('booking_events')
      .update({ 
        is_active: false,
        version_number: event.version_number + 1
      })
      .eq('id', event.id);
    
    // Also mark related cleaner assignments as inactive
    await supabase
      .from('cleaner_assignments')
      .update({ is_active: false })
      .eq('event_id', event.event_id);
    
    counters.eventsDeactivated += 1;
    counters.eventsVersioned += 1;
  }
  
  return staleEvents.length;
};

// Sync booking events for all listings - new version with versioning
export const syncBookingEventsForListings = async (baseUrl?: string, startDate?: string, endDate?: string) => {
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
  
  console.log(`Syncing iCal feeds from ${startDate} to ${endDate}`);
  
  // Get all listings
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('*');
  
  if (listingsError) throw listingsError;
  
  // Filter out manual listings (those with external_id starting with 'manual-')
  const syncableListings = listings.filter(listing => 
    !listing.external_id?.startsWith('manual-')
  );
  
  console.log(`Starting sync for ${syncableListings.length} syncable listings (filtered out ${listings.length - syncableListings.length} manual listings)`);

  // Initialize counters for sync
  let listingsProcessed = 0;
  let feedsProcessed = 0;
  let eventsAdded = 0;
  let eventsUpdated = 0;
  let eventsDeactivated = 0;
  let eventsVersioned = 0;
  let legacyUrlsMigrated = 0;
  
  // Create a sync session to track this operation
  const { data: sessionData, error: sessionError } = await supabase
    .from('sync_sessions')
    .insert({
      sync_type: 'all',
      status: 'pending',
      triggered_by: 'automatic',
      started_at: new Date().toISOString(),
      total_listings: syncableListings.length,
      total_events_processed: 0,
      total_feeds_processed: 0,
      total_added: 0,
      total_updated: 0,
      total_deactivated: 0,
      total_replaced: 0,
      total_unchanged: 0,
      total_errors: 0,
      completed_listings: 0,
      metadata: {
        apiBaseUrl,
        dateRange: { startDate, endDate }
      }
    })
    .select()
    .single();

  if (sessionError || !sessionData) {
    throw new Error(`Failed to create sync session: ${sessionError?.message || 'No data returned'}`);
  }

  const sessionId = sessionData.id;
  console.log(`Created sync session with ID: ${sessionId}`);

  // Update session to in_progress
  await supabase
    .from('sync_sessions')
    .update({ status: 'in_progress' })
    .eq('id', sessionId);

  try {
    // Check how many active events we have before starting
    const { count: activeEventsBefore } = await supabase
      .from('booking_events')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    
    console.log(`Before sync: ${activeEventsBefore || 0} active events in database`);

    // 2. Process listings in parallel
    // Create a function to process a single listing that we can call with Promise.all
    const processListing = async (listing: any) => {
      const listingResult = {
        listingId: listing.id,
        feedsProcessed: 0,
        legacyUrlsMigrated: 0,
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
          console.log(`No iCal feeds found for listing ${listing.name} (${listing.id})`);
          return listingResult;
        }
        
        console.log(`Found ${icalFeeds.length} feeds for listing ${listing.name}`);
        
        // Process feeds in parallel
        const feedResults = await Promise.all(
          icalFeeds.filter(feed => feed.is_active).map(async (feed) => {
            const feedResult = {
              feedId: feed.id,
              eventsFound: 0,
              eventIds: [] as string[]
            };
            
            try {
              console.log(`Fetching events for feed: ${feed.name} (${feed.id})`);
              
              // When calling the fetch-ical API, pass the date range
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

              const data = await response.json();
              if (!response.ok) {
                console.error(`Failed to fetch iCal data for ${feed.name}:`, data.error);
                return feedResult;
              }

              console.log(`Received ${data.events.length} events from feed ${feed.name}`);
              feedResult.eventsFound = data.events.length;

              // Process each event from the ical feed
              for (const event of data.events) {
                const startTime = new Date(event.start);
                const endTime = new Date(event.end);
                
                // Create event IDs and add to active list
                const checkInEventId = `checkin-${event.id}`;
                const checkOutEventId = `checkout-${event.id}`;
                
                feedResult.eventIds.push(checkInEventId, checkOutEventId);
                
                // Check if this is a same-day checkout by looking for other events
                // with check-in on the same day as this event's checkout
                const sameEndDateEvents = data.events.filter((otherEvent: any) => {
                  if (otherEvent === event) return false; // Skip comparing with self
                  
                  const otherStartTime = new Date(otherEvent.start);
                  return endTime.toDateString() === otherStartTime.toDateString();
                });
                
                const isSameDayCheckout = sameEndDateEvents.length > 0;
                
                // Create check-in event with fingerprint
                const checkInFingerprint = createEventFingerprint({
                  start_time: startTime.toISOString(),
                  end_time: startTime.toISOString(),
                  title: `Check-in: ${event.title}`,
                  guest_name: event.title.split(' - ')[0] || null
                });
                
                const checkInResult = await processBookingEvent({
                  listing_id: listing.id,
                  ical_feed_id: feed.id,
                  event_id: checkInEventId,
                  title: `Check-in: ${event.title}`,
                  start_time: startTime.toISOString(),
                  end_time: startTime.toISOString(),
                  is_check_in: true,
                  is_check_out: false,
                  is_same_day_checkout: isSameDayCheckout,
                  guest_name: event.title.split(' - ')[0] || null,
                  is_active: true,
                  last_synced: new Date().toISOString(),
                  event_fingerprint: checkInFingerprint
                }, { eventsAdded: 0, eventsUpdated: 0, eventsVersioned: 0 }, sessionId);
                
                if (checkInResult.added) listingResult.eventsAdded++;
                if (checkInResult.updated) listingResult.eventsUpdated++;
                if (checkInResult.versioned) listingResult.eventsVersioned++;

                // Create check-out event with fingerprint
                const checkOutFingerprint = createEventFingerprint({
                  start_time: endTime.toISOString(),
                  end_time: endTime.toISOString(),
                  title: `Check-out: ${event.title}`,
                  guest_name: event.title.split(' - ')[0] || null
                });
                
                const checkOutResult = await processBookingEvent({
                  listing_id: listing.id,
                  ical_feed_id: feed.id,
                  event_id: checkOutEventId,
                  title: `Check-out: ${event.title}`,
                  start_time: endTime.toISOString(),
                  end_time: endTime.toISOString(),
                  is_check_in: false,
                  is_check_out: true,
                  is_same_day_checkout: isSameDayCheckout,
                  guest_name: event.title.split(' - ')[0] || null,
                  is_active: true,
                  last_synced: new Date().toISOString(),
                  event_fingerprint: checkOutFingerprint
                }, { eventsAdded: 0, eventsUpdated: 0, eventsVersioned: 0 }, sessionId);
                
                if (checkOutResult.added) listingResult.eventsAdded++;
                if (checkOutResult.updated) listingResult.eventsUpdated++;
                if (checkOutResult.versioned) listingResult.eventsVersioned++;
              }

              // Update last synced time for the feed
              await supabase
                .from('ical_feeds')
                .update({ last_synced: new Date().toISOString() })
                .eq('id', feed.id);
              
              listingResult.feedsProcessed++;
              
              return feedResult;
            } catch (error) {
              console.error(`Error processing feed ${feed.id} for listing ${listing.id}:`, error);
              return feedResult;
            }
          })
        );
        
        // Collect all active event IDs from all feeds
        feedResults.forEach(feedResult => {
          listingResult.eventsFound += feedResult.eventsFound;
          listingResult.activeEventIds.push(...feedResult.eventIds);
        });
        
        console.log(`Completed processing all feeds for listing ${listing.name}, found ${listingResult.activeEventIds.length} active events`);
        
        // After processing all feeds for this listing, deactivate any stale events
        if (listingResult.activeEventIds.length > 0) {
          console.log(`Deactivating stale events for listing ${listing.name} using ${listingResult.activeEventIds.length} active event IDs`);
          const deactivatedCount = await deactivateStaleEvents(
            listing.id, 
            listingResult.activeEventIds, 
            new Date().toISOString(), 
            { eventsDeactivated: 0, eventsVersioned: 0 },
            sessionId
          );
          console.log(`Deactivated ${deactivatedCount} stale events for listing ${listing.name}`);
          listingResult.eventsDeactivated = deactivatedCount;
        } else {
          console.warn(`No active events found for listing ${listing.name}, skipping deactivation step`);
        }
        
        return listingResult;
      } catch (error) {
        console.error(`Error processing listing ${listing.id}:`, error);
        return listingResult;
      }
    };

    // Process all listings in parallel with a concurrency limit of 5 to avoid overwhelming the system
    const processBatch = async (batch: any[]) => {
      return Promise.all(batch.map(listing => processListing(listing)));
    };
    
    // Split listings into batches of 5 and process each batch
    const BATCH_SIZE = 5;
    const listingResults = [];
    
    for (let i = 0; i < syncableListings.length; i += BATCH_SIZE) {
      const batch = syncableListings.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch of ${batch.length} listings (${i+1} to ${Math.min(i+BATCH_SIZE, syncableListings.length)} of ${syncableListings.length})`);
      const batchResults = await processBatch(batch);
      listingResults.push(...batchResults);
      
      // Increment counters for this batch
      batchResults.forEach(result => {
        listingsProcessed++;
        feedsProcessed += result.feedsProcessed;
        eventsAdded += result.eventsAdded;
        eventsUpdated += result.eventsUpdated;
        eventsVersioned += result.eventsVersioned;
        eventsDeactivated += result.eventsDeactivated;
        legacyUrlsMigrated += result.legacyUrlsMigrated;
      });
      
      console.log(`Completed batch. Progress: ${listingsProcessed}/${syncableListings.length} listings processed`);
    }

    // Check how many active events we have after the sync
    const { count: activeEventsAfter } = await supabase
      .from('booking_events')
      .select('id', { count: 'exact' })
      .eq('is_active', true);
    
    console.log(`After sync: ${activeEventsAfter || 0} active events in database (changed by ${(activeEventsAfter || 0) - (activeEventsBefore || 0)})`);
    
    // Update sync session with final counts
    await supabase
      .from('sync_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_events_processed: eventsAdded + eventsUpdated + eventsDeactivated,
        total_feeds_processed: feedsProcessed,
        total_added: eventsAdded,
        total_updated: eventsUpdated,
        total_deactivated: eventsDeactivated,
        completed_listings: listingsProcessed
      })
      .eq('id', sessionId);

    return {
      listingsProcessed,
      feedsProcessed,
      eventsAdded,
      eventsUpdated,
      eventsDeactivated,
      eventsVersioned,
      sessionId
    };
  } catch (error) {
    // Update sync session with error status
    await supabase
      .from('sync_sessions')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    throw error;
  }
};

// Migration helper to create associations between existing listings and ical feeds
export const migrateExistingData = async () => {
  // Get all listings and ical feeds
  const { data: listings } = await supabase.from('listings').select('*');
  const { data: icalFeeds } = await supabase.from('ical_feeds').select('*');
  
  if (!listings || !icalFeeds) {
    throw new Error('Could not retrieve listings or ical feeds');
  }
  
  const associations = [];
  
  // Find matching feeds for each listing
  for (const listing of listings) {
    const matchingFeeds = icalFeeds.filter(feed => 
      listing.external_id === `listing-${feed.external_id}` || 
      listing.external_id.includes(feed.external_id)
    );
    
    for (const feed of matchingFeeds) {
      associations.push({
        listing_id: listing.id,
        ical_feed_id: feed.id
      });
    }
  }
  
  // Create all associations
  if (associations.length > 0) {
    await supabase.from('listing_ical_feeds').insert(associations);
  }
  
  // Now sync all feeds to populate booking_events
  return syncBookingEventsForListings();
};

// Update assignments active status based on current events
export const updateAssignmentsActiveStatus = async (events: any[]) => {
  // Get all assignments
  const { data: assignments, error } = await supabase
    .from('cleaner_assignments')
    .select('*');
  
  if (error) throw error;
  
  // Create a map of valid event IDs
  const validEventIds = new Set(events.map(event => event.id));
  
  // Track assignments to update
  const assignmentsToUpdate = [];
  
  // Check each assignment against valid events
  for (const assignment of assignments) {
    const isStillActive = validEventIds.has(assignment.event_id);
    
    // If active status changed, mark for update
    if (assignment.is_active !== isStillActive) {
      assignmentsToUpdate.push({
        id: assignment.id,
        is_active: isStillActive
      });
    }
  }
  
  // Update assignments in batches if needed
  if (assignmentsToUpdate.length > 0) {
    // Update in batches of 50 to avoid hitting limits
    for (let i = 0; i < assignmentsToUpdate.length; i += 50) {
      const batch = assignmentsToUpdate.slice(i, i + 50);
      
      // Update each assignment in the batch
      for (const update of batch) {
        await supabase
          .from('cleaner_assignments')
          .update({ is_active: update.is_active })
          .eq('id', update.id);
      }
    }
  }
  
  return {
    totalChecked: assignments.length,
    updatedCount: assignmentsToUpdate.length
  };
};

// Cleaners
export const getCleaners = async (): Promise<Cleaner[]> => {
  const { data, error } = await supabase
    .from('cleaners')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching cleaners:', error);
    throw error;
  }
  
  // Transform the response to match our interface
  return data.map(cleaner => ({
    id: cleaner.id,
    name: cleaner.name,
    hourly_rate: cleaner.hourly_rate,
    password: cleaner.password,
    external_id: cleaner.external_id,
    is_active: cleaner.is_active,
    created_at: cleaner.created_at,
    updated_at: cleaner.updated_at,
    role: cleaner.role
  }));
};

export const createCleaner = async (cleaner: Omit<Cleaner, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('cleaners')
    .insert(cleaner)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updateCleaner = async (uuid: string, updates: Partial<Omit<Cleaner, 'id' | 'created_at' | 'updated_at'>>) => {
  const { data, error } = await supabase
    .from('cleaners')
    .update(updates)
    .eq('id', uuid)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteCleaner = async (uuid: string) => {
  const { error } = await supabase
    .from('cleaners')
    .delete()
    .eq('id', uuid);
  
  if (error) throw error;
};

// Cleaner authentication
export const authenticateCleaner = async (name: string, password: string) => {
  if (!name || !password) return null;
  
  const { data, error } = await supabase
    .from('cleaners')
    .select('*')
    .eq('name', name)
    .single();
  
  if (error || !data) return null;
  
  // Simple password comparison (plain text for now)
  if (data.password === password) {
    // Remove password before returning and map id to uuid
    const { password: pwd, ...rest } = data;
    return { ...rest, uuid: data.id, role: data.role };
  }
  
  return null;
};

// Get cleaner by UUID
export const getCleanerById = async (uuid: string) => {
  const { data, error } = await supabase
    .from('cleaners')
    .select('*')
    .eq('id', uuid)
    .single();
  
  if (error) throw error;
  
  // Remove password from response and map id to uuid
  if (data) {
    const { password, ...rest } = data;
    return { ...rest, uuid: data.id, role: data.role };
  }
  
  return null;
};

// Get assignments for a specific cleaner with date constraints (for cleaner portal)
export const getCleanerUpcomingAssignments = async (cleanerId: string) => {
  // Calculate today and two weeks from now
  const today = new Date();
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(today.getDate() + 14);
  
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .select('*')
    .eq('cleaner_id', cleanerId)
    .eq('is_active', true)
    .gte('assignment_date', today.toISOString())
    .lte('assignment_date', twoWeeksLater.toISOString())
    .order('assignment_date', { ascending: true });
  
  if (error) throw error;
  return data;
};

// Cleaner Assignments
export const getCleanerAssignments = async (cleanerUuid?: string) => {
  let query = supabase
    .from('cleaner_assignments')
    .select('*');
  
  if (cleanerUuid) {
    query = query.eq('cleaner_uuid', cleanerUuid);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data;
};

export const createCleanerAssignment = async (assignment: Omit<CleanerAssignment, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .insert(assignment)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updateCleanerAssignment = async (id: string, updates: Partial<Omit<CleanerAssignment, 'id' | 'created_at' | 'updated_at'>>) => {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteCleanerAssignment = async (id: string) => {
  const { error } = await supabase
    .from('cleaner_assignments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// System maintenance functions
export const ensureIcalFeedsHaveListings = async () => {
  // Get all ical feeds
  const { data: icalFeeds, error: feedsError } = await supabase
    .from('ical_feeds')
    .select('*');
  
  if (feedsError) throw feedsError;
  
  // Get all listings
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('*');
  
  if (listingsError) throw listingsError;

  // Get all existing associations
  const { data: existingAssociations, error: assocError } = await supabase
    .from('listing_ical_feeds')
    .select('*');

  if (assocError) throw assocError;
  
  // Keep track of created listings and associations
  const createdListings = [];
  const createdAssociations = [];
  const errors = [];
  
  // For each ical feed, check if it has corresponding listing and association
  for (const feed of icalFeeds) {
    try {
      // Check if a listing with this external_id already exists
      const existingListing = listings.find(
        listing => 
          listing.external_id === `listing-${feed.external_id}` || 
          listing.external_id.includes(feed.external_id)
      );
      
      let listingId;
      
      if (!existingListing) {
        // Create a new listing from the feed data
        const { data, error } = await supabase
          .from('listings')
          .insert({
            external_id: `listing-${feed.external_id}`,
            name: feed.name,
            color: feed.is_active ? feed.color : null,
            hours: 2.0
          })
          .select();
        
        if (error) throw error;
        createdListings.push(data[0]);
        listingId = data[0].id;
      } else {
        listingId = existingListing.id;
      }
      
      // Check if association already exists
      const hasAssociation = existingAssociations.some(
        assoc => assoc.listing_id === listingId && assoc.ical_feed_id === feed.id
      );
      
      if (!hasAssociation) {
        // Create association
        const { data, error } = await supabase
          .from('listing_ical_feeds')
          .insert({
            listing_id: listingId,
            ical_feed_id: feed.id
          })
          .select();
        
        if (error) throw error;
        createdAssociations.push(data[0]);
      }
    } catch (error) {
      console.error(`Error processing feed ${feed.id}:`, error);
      errors.push({
        feedId: feed.id,
        feedName: feed.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return {
    success: errors.length === 0,
    totalFeeds: icalFeeds.length,
    totalListings: listings.length,
    createdListings,
    createdAssociations,
    errors
  };
};

// Function to detect and clean up duplicate listings
export const cleanupDuplicateListings = async () => {
  try {
    // Get all ical feeds
    const { data: icalFeeds, error: feedsError } = await supabase
      .from('ical_feeds')
      .select('*');
    
    if (feedsError) throw feedsError;
    
    // Get all listings
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('*');
    
    if (listingsError) throw listingsError;
    
    // Track results
    const deletedListings = [];
    const errors = [];
    
    // For each feed, find all its listings
    for (const feed of icalFeeds) {
      try {
        // Find all listings that match this feed
        const matchingListings = listings.filter(listing => 
          listing.external_id === `listing-${feed.external_id}` || 
          listing.external_id.includes(feed.external_id) || 
          listing.ical_url === feed.url
        );
        
        // If more than one listing exists for this feed, keep only the newest one
        if (matchingListings.length > 1) {
          console.log(`Found ${matchingListings.length} listings for feed ${feed.name}`, matchingListings);
          
          // Sort by created_at date, newest first
          const sortedListings = [...matchingListings].sort((a, b) => {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          });
          
          // Keep the first one (newest), delete the rest
          const [keepListing, ...duplicatesToDelete] = sortedListings;
          
          // Update the listing we're keeping to ensure it has the correct values
          await supabase
            .from('listings')
            .update({
              name: feed.name,
              color: feed.is_active ? feed.color : null,
              external_id: `listing-${feed.external_id}`
            })
            .eq('id', keepListing.id);
          
          // Make sure the keeper listing has an association with the feed
          const { data: existingAssoc } = await supabase
            .from('listing_ical_feeds')
            .select('*')
            .eq('listing_id', keepListing.id)
            .eq('ical_feed_id', feed.id);
          
          if (!existingAssoc || existingAssoc.length === 0) {
            await supabase
              .from('listing_ical_feeds')
              .insert({
                listing_id: keepListing.id,
                ical_feed_id: feed.id
              });
          }
          
          // Delete all duplicates
          for (const duplicate of duplicatesToDelete) {
            const { error } = await supabase
              .from('listings')
              .delete()
              .eq('id', duplicate.id);
            
            if (error) {
              console.error(`Error deleting duplicate listing ${duplicate.id}:`, error);
              errors.push({ listingId: duplicate.id, error: error.message });
            } else {
              deletedListings.push(duplicate);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing feed ${feed.id}:`, error);
        errors.push({ feedId: feed.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return {
      success: errors.length === 0,
      deletedCount: deletedListings.length,
      deletedListings,
      errors
    };
  } catch (error) {
    console.error('Error cleaning up duplicate listings:', error);
    throw error;
  }
};

// Reactivate future events that may have been incorrectly marked as inactive
export const reactivateFutureEvents = async () => {
  console.log('Reactivating future events that may have been incorrectly marked as inactive...');
  
  // Find all inactive events with future dates
  const { data: inactiveEvents, error } = await supabase
    .from('booking_events')
    .select('id, event_id, start_time, end_time')
    .eq('is_active', false)
    .gt('start_time', new Date().toISOString());
  
  if (error) {
    console.error('Error finding inactive future events:', error);
    throw error;
  }
  
  if (!inactiveEvents || inactiveEvents.length === 0) {
    console.log('No inactive future events found that need reactivation');
    return { reactivated: 0 };
  }
  
  console.log(`Found ${inactiveEvents.length} inactive future events to reactivate`);
  
  // Reactivate them all
  const { error: updateError } = await supabase
    .from('booking_events')
    .update({ is_active: true })
    .in('id', inactiveEvents.map(event => event.id));
  
  if (updateError) {
    console.error('Error reactivating future events:', updateError);
    throw updateError;
  }
  
  // Also reactivate any associated cleaner assignments
  if (inactiveEvents.length > 0) {
    const { error: assignmentError } = await supabase
      .from('cleaner_assignments')
      .update({ is_active: true })
      .in('event_id', inactiveEvents.map(event => event.event_id));
    
    if (assignmentError) {
      console.log('Warning: Could not reactivate associated cleaner assignments:', assignmentError);
    }
  }
  
  console.log(`Successfully reactivated ${inactiveEvents.length} future events`);
  return { reactivated: inactiveEvents.length };
};

export const loadCleanerAssignments = async (options: CleanerAssignmentOptions = {}) => {
  try {
    // Start building the query
    let query = supabase.from('cleaner_assignments').select(
      options.includeEvent || options.includeCleaner
        ? `
          *,
          ${options.includeCleaner ? 'cleaner:cleaner_uuid(id, name, hourly_rate),' : ''}
          ${options.includeEvent ? 'event:event_uuid(uuid, event_id, listing_name, checkin_date, checkout_date, is_active)' : ''}
        `.trim()
        : '*'
    );

    // Apply filters if provided
    if (options.cleanerUuid) {
      query = query.eq('cleaner_uuid', options.cleanerUuid);
    }

    if (options.eventUuid) {
      query = query.eq('event_uuid', options.eventUuid);
    }

    if (typeof options.isActive === 'boolean') {
      query = query.eq('is_active', options.isActive);
    }

    // Apply ordering if specified
    if (options.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending
      });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading cleaner assignments:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in loadCleanerAssignments:', error);
    throw error;
  }
}; 