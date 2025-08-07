import { supabase } from './supabase';

// Core interfaces
export interface CalendarEvent {
  id: string;
  event_uid: string;
  listing_id: string;
  title: string;
  start_time: string;
  end_time: string;
  is_check_in: boolean;
  is_check_out: boolean;
  is_same_day_checkout: boolean;
  checkout_time: string;
  guest_name: string | null;
  is_active: boolean;
  event_fingerprint: string;
  version_number: number;
  feed_id: string;
  last_synced: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarEventVersion {
  id: string;
  event_id: string;
  version_number: number;
  previous_start_time: string;
  previous_end_time: string;
  change_type: 'created' | 'moved' | 'canceled';
  sync_id?: string;
  created_at?: string;
}

// Define an interface for the event from the new schema
export interface Event {
  uuid: string;
  event_id: string;
  listing_name: string;
  listing_hours: string;
  checkin_date: string;
  checkout_date: string;
  checkout_type: string;
  checkout_time: string;
  is_active: boolean;
  event_type: string;
  created_at?: string;
  updated_at?: string;
}

export interface CleanerEventAssignment {
  uuid: string;
  event_uuid: string;
  cleaner_uuid: string;
  hours: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  event?: Event; // Added for joins with events table
}

export interface SyncResult {
  listingsProcessed: number;
  feedsProcessed: number;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeactivated: number;
  eventsVersioned: number;
}

export interface SyncStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  last_sync_time: string | null;
  error_message: string | null;
  created_at?: string;
}

// Generate event fingerprint for detecting changes
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

// Get calendar events by date range
export const getCalendarEventsByDateRange = async (
  startDate: string, 
  endDate: string,
  listingId?: string,
  includeInactive: boolean = false,
  versionNumber?: number
) => {
  // Start building the query
  let query = supabase
    .from('calendar_events')
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
  
  // Transform the data to match expected calendar event format
  return data.map(event => ({
    id: event.event_uid,
    eventId: event.id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    listing: event.listing?.name,
    listingId: event.listing_id,
    color: event.listing?.color,
    isCheckIn: event.is_check_in,
    isCheckOut: event.is_check_out,
    isSameDayCheckout: event.is_same_day_checkout,
    checkoutTime: event.checkout_time,
    guestName: event.guest_name,
    isActive: event.is_active,
    version: event.version_number
  }));
};

// Get calendar events for a specific listing
export const getCalendarEventsForListing = async (
  listingId: string, 
  startDate: string, 
  endDate: string
) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*, listing:listing_id(name, color)')
    .eq('listing_id', listingId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)
    .eq('is_active', true);
  
  if (error) throw error;
  
  return data.map(event => ({
    id: event.event_uid,
    eventId: event.id,
    title: event.title,
    start: new Date(event.start_time),
    end: new Date(event.end_time),
    listing: event.listing?.name,
    listingId: event.listing_id,
    color: event.listing?.color,
    isCheckIn: event.is_check_in,
    isCheckOut: event.is_check_out,
    isSameDayCheckout: event.is_same_day_checkout,
    checkoutTime: event.checkout_time,
    guestName: event.guest_name
  }));
};

// Get event versions
export const getCalendarEventVersions = async (eventId: string) => {
  const { data, error } = await supabase
    .from('calendar_event_versions')
    .select('*')
    .eq('event_id', eventId)
    .order('version_number', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Create event version
export const createCalendarEventVersion = async (
  eventId: string,
  versionNumber: number,
  previousStartTime: string,
  previousEndTime: string,
  changeType: 'created' | 'moved' | 'canceled',
  syncId?: string
) => {
  const { data, error } = await supabase
    .from('calendar_event_versions')
    .insert({
      event_id: eventId,
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

// Increment event version
export const incrementEventVersion = async (id: string, currentVersion: number) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .update({ version_number: currentVersion + 1 })
    .eq('id', id)
    .select();
  
  if (error) throw error;
  return data[0];
};

// Sync status management
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

export const getLatestSyncStatus = async (): Promise<SyncStatus | null> => {
  const { data, error } = await supabase
    .from('sync_status')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  return data[0] || null;
};

// Cleaner assignment management
export const getCleanerAssignments = async (cleanerUuid?: string) => {
  // Build the query to get cleaner assignments with their related cleaner and event data
  let query = supabase
    .from('cleaner_assignments')
    .select(`
      *,
      cleaner:cleaner_uuid(id, name, hourly_rate),
      event:event_uuid(
        uuid, 
        event_id, 
        listing_name, 
        listing_hours, 
        checkin_date, 
        checkout_date, 
        checkout_type, 
        checkout_time, 
        is_active
      )
    `)
    .eq('is_active', true);
  
  // If cleaner UUID is provided, filter by it
  if (cleanerUuid) {
    query = query.eq('cleaner_uuid', cleanerUuid);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching cleaner assignments:', error);
    throw error;
  }
  
  // Log for debugging
  console.log(`Retrieved ${data?.length || 0} cleaner assignments`);
  
  // Return the assignments
  return data;
};

export const createCleanerAssignment = async (assignment: {
  cleaner_uuid: string;
  event_uuid: string;
  hours: number;
  is_active?: boolean;
}) => {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .insert({
      cleaner_uuid: assignment.cleaner_uuid,
      event_uuid: assignment.event_uuid,
      hours: assignment.hours,
      is_active: assignment.is_active !== undefined ? assignment.is_active : true
    })
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updateCleanerAssignment = async (uuid: string, updates: {
  cleaner_uuid?: string;
  hours?: number;
  is_active?: boolean;
}) => {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .update(updates)
    .eq('uuid', uuid)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteCleanerAssignment = async (uuid: string) => {
  const { error } = await supabase
    .from('cleaner_assignments')
    .delete()
    .eq('uuid', uuid);
  
  if (error) throw error;
  return true;
};

// Find an assignment for a specific event and cleaner
export const findCleanerAssignment = async (eventUuid: string, cleanerUuid: string) => {
  const { data, error } = await supabase
    .from('cleaner_assignments')
    .select('*')
    .eq('event_uuid', eventUuid)
    .eq('cleaner_uuid', cleanerUuid)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error) throw error;
  return data;
};

// Update cleaner assignments when an event changes
export const updateAffectedCleanerAssignments = async (eventId: string, newStartTime: string, newEndTime: string) => {
  // Find all cleaner assignments for this event
  const { data: assignments } = await supabase
    .from('cleaner_event_assignments')
    .select('*')
    .eq('event_id', eventId);
  
  if (!assignments || assignments.length === 0) return;
  
  // Update each assignment - for checkout events use the end_time
  for (const assignment of assignments) {
    // Get the event to determine if it's a check-in or check-out
    const { data: eventData } = await supabase
      .from('calendar_events')
      .select('is_check_in, is_check_out')
      .eq('id', eventId)
      .single();
    
    if (!eventData) continue;
    
    // For checkout events, use end_time; for check-in events, use start_time
    const eventDate = eventData.is_check_out ? newEndTime : newStartTime;
    
    await supabase
      .from('cleaner_event_assignments')
      .update({ assignment_date: eventDate })
      .eq('id', assignment.id);
  }
  
  return assignments.length;
};

// Update assignments active status based on event status
export const updateAssignmentsActiveStatus = async (events: any[]) => {
  console.log('Checking cleaner assignment status for', events.length, 'events');
  
  // Get all cleaner assignments
  const { data: cleanerAssignments, error: cleanerAssignmentsError } = await supabase
    .from('cleaner_assignments')
    .select('*, event:event_uuid(uuid, event_id, is_active)');
  
  if (cleanerAssignmentsError) {
    console.error('Error fetching cleaner_assignments:', cleanerAssignmentsError);
    return { totalChecked: 0, updatedCount: 0 };
  }
  
  console.log(`Found ${cleanerAssignments?.length || 0} total cleaner assignments`);
  
  if (!cleanerAssignments || cleanerAssignments.length === 0) {
    return { totalChecked: 0, updatedCount: 0 };
  }
  
  // Create map of valid event UUIDs from the current events
  const validEventUuids = new Set(events.map(event => event.uuid));
  const validEventIds = new Set(events.map(event => event.id || event.eventId));
  
  // Additionally, get all active events from the database to ensure we don't deactivate valid assignments
  const { data: activeEvents, error: eventsError } = await supabase
    .from('events')
    .select('uuid, event_id')
    .eq('is_active', true);
  
  if (eventsError) {
    console.error('Error fetching active events:', eventsError);
  } else if (activeEvents) {
    // Add these UUIDs to the valid event UUIDs set
    activeEvents.forEach(event => {
      validEventUuids.add(event.uuid);
      validEventIds.add(event.event_id);
    });
    console.log(`Merged with ${activeEvents.length} active events from database`);
  }
  
  console.log(`Total valid event UUIDs: ${validEventUuids.size}`);
  
  // Track assignments to update
  const assignmentsToUpdate = [];
  
  // Check each assignment against valid events
  for (const assignment of cleanerAssignments) {
    // Check if the event UUID is in our valid events set
    const isStillActive = validEventUuids.has(assignment.event_uuid);
    
    // Log if we're about to deactivate an assignment
    if (assignment.is_active && !isStillActive) {
      console.log(`Assignment ${assignment.uuid} for event ${assignment.event_uuid} will be deactivated`);
    }
    
    // If active status changed, mark for update 
    if (assignment.is_active !== isStillActive) {
      assignmentsToUpdate.push({
        uuid: assignment.uuid,
        is_active: isStillActive
      });
    }
  }
  
  console.log(`Found ${assignmentsToUpdate.length} cleaner assignments that need updating`);
  
  // Update assignments in batches if needed
  let updatedCount = 0;
  if (assignmentsToUpdate.length > 0) {
    console.log(`Updating ${assignmentsToUpdate.length} cleaner assignments...`);
    
    // Update in batches of 50 to avoid hitting limits
    for (let i = 0; i < assignmentsToUpdate.length; i += 50) {
      const batch = assignmentsToUpdate.slice(i, i + 50);
      
      // Update each assignment in the batch
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('cleaner_assignments')
          .update({ 
            is_active: update.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('uuid', update.uuid);
          
        if (updateError) {
          console.error(`Error updating assignment ${update.uuid}:`, updateError);
        } else {
          updatedCount++;
        }
      }
    }
    
    console.log(`Updated ${updatedCount} cleaner assignments successfully`);
  } else {
    console.log('No assignments need updating');
  }
  
  return {
    totalChecked: cleanerAssignments.length,
    updatedCount: updatedCount
  };
};

// Get upcoming assignments for a cleaner
export const getCleanerUpcomingAssignments = async (cleanerUuid: string) => {
  // Calculate today and two weeks from now
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(today.getDate() + 14);
  twoWeeksLater.setHours(23, 59, 59, 999);
  
  console.log('Date range for filtering:');
  console.log('Today (start):', today.toISOString());
  console.log('Two weeks later (end):', twoWeeksLater.toISOString());
  
  // Query all assignments first
  const { data: allAssignments, error } = await supabase
    .from('cleaner_assignments')
    .select(`
      *,
      event:event_uuid(*)
    `)
    .eq('cleaner_uuid', cleanerUuid)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error in getCleanerUpcomingAssignments:', error);
    throw error;
  }
  
  console.log(`Total assignments from database: ${allAssignments?.length || 0}`);

  // Filter active assignments for the calendar view
  const activeAssignments = allAssignments?.filter(assignment => {
    if (!assignment.event) {
      console.log(`Assignment ${assignment.uuid}: Skipped - No event data`);
      return false;
    }

    // Check if both assignment and event are active
    if (!assignment.is_active || !assignment.event.is_active) {
      console.log(`Assignment ${assignment.uuid}: Skipped - Inactive (assignment: ${assignment.is_active}, event: ${assignment.event.is_active})`);
      return false;
    }

    // Parse the checkout date
    const checkoutDate = new Date(assignment.event.checkout_date);
    const dayOfWeek = checkoutDate.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Set the checkout date to noon to avoid timezone issues
    checkoutDate.setHours(12, 0, 0, 0);
    
    // Check if the date is within our date range
    const isInRange = checkoutDate >= today && checkoutDate <= twoWeeksLater;
    
    // Special handling for Monday and Tuesday - always show these
    const isSpecialDay = dayOfWeek === 1 || dayOfWeek === 2;
    
    console.log(`Assignment ${assignment.uuid} (${assignment.event.listing_name}):`, {
      checkoutDate: checkoutDate.toISOString(),
      dayOfWeek: dayNames[dayOfWeek],
      isInRange,
      isSpecialDay,
      included: isInRange || isSpecialDay
    });
    
    return isInRange || isSpecialDay;
  }) || [];

  console.log('Active assignments after filtering:');
  activeAssignments.forEach(assignment => {
    console.log(`- ${assignment.event?.listing_name}: ${assignment.event?.checkout_date}`);
  });
  
  return {
    activeAssignments,
    allAssignments: allAssignments || []
  };
};

// Update checkout time for an event
export const updateEventCheckoutTime = async (eventId: string, checkoutTime: string) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .update({ checkout_time: checkoutTime })
    .eq('id', eventId)
    .select();
  
  if (error) throw error;
  return data[0];
}; 