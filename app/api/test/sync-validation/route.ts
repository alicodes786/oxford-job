import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getBookingEventsByDateRange, getLatestSyncStatus, getListings, getIcalFeedsForListing } from '@/lib/models';

// Define an interface for the normalized events
interface NormalizedEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  listing: string;
  isCheckIn: boolean;
  isCheckOut: boolean;
  isActive: boolean;
}

// Utility function to format date for comparison
const formatDateForComparison = (date: Date | string) => {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

// Add a function to check for imbalanced listings
function findImbalancedListings(events: NormalizedEvent[]): Array<{ 
  listing: string; 
  checkIns: number; 
  checkOuts: number; 
  difference: number;
}> {
  const listingMap = new Map<string, { checkIns: number; checkOuts: number }>();
  
  // Count check-ins and check-outs for each listing
  for (const event of events) {
    // Skip events with undefined listing
    if (!event.listing) continue;
    
    if (!listingMap.has(event.listing)) {
      listingMap.set(event.listing, { checkIns: 0, checkOuts: 0 });
    }
    
    const counts = listingMap.get(event.listing)!;
    if (event.isCheckIn) {
      counts.checkIns++;
    } else if (event.isCheckOut) {
      counts.checkOuts++;
    }
  }
  
  // Find listings with imbalanced events
  const imbalanced = [];
  for (const [listing, counts] of listingMap.entries()) {
    const difference = Math.abs(counts.checkIns - counts.checkOuts);
    if (difference > 0) {
      imbalanced.push({
        listing,
        checkIns: counts.checkIns,
        checkOuts: counts.checkOuts,
        difference
      });
    }
  }
  
  return imbalanced.sort((a, b) => b.difference - a.difference);
}

// Keep the existing event normalization function but ensure listing is always a string
const normalizeEvent = (event: any, source: 'database' | 'calendar' | 'ical'): NormalizedEvent => {
  return {
    id: event.id || `${source}-${Date.now()}-${Math.random()}`,
    title: event.title || '',
    start: event.start || event.startDate || '',
    end: event.end || event.endDate || '',
    listing: event.listing || event.propertyName || 'Unknown',  // Always provide a default
    isCheckIn: !!event.isCheckIn,
    isCheckOut: !!event.isCheckOut,
    isActive: !!event.isActive
  };
};

// API endpoint to validate calendar data versus database data
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    
    // Check if we should do a direct iCal comparison
    const compareWithIcal = url.searchParams.get('compareIcal') === 'true';
    
    // Get date range from query parameters or use default (3 months back, 6 months ahead)
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    
    // Default date range if not provided
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    const sixMonthsAhead = new Date(today);
    sixMonthsAhead.setMonth(today.getMonth() + 6);
    
    const startDate = startDateParam || threeMonthsAgo.toISOString();
    const endDate = endDateParam || sixMonthsAhead.toISOString();

    // Get the latest sync information
    const latestSync = await getLatestSyncStatus();
    
    // Check when events were last synced
    if (!latestSync) {
      return NextResponse.json({
        success: false,
        error: "No sync history found",
        recommendation: "Run a sync first to establish baseline data"
      }, { status: 400 });
    }

    // Fetch events directly from the database for the most accurate data
    const dbEvents = await getBookingEventsByDateRange(startDate, endDate);
    
    // Initialize variables for iCal data if we're comparing with it
    let icalsProcessed = 0;
    let icalEvents: any[] = [];
    let icalSourceDetails = [];
    
    // If requested, fetch data directly from iCal sources
    if (compareWithIcal) {
      try {
        // Get all listings
        const listings = await getListings();
        
        // For each listing, get its iCal feeds and fetch the events
        for (const listing of listings) {
          const icalFeeds = await getIcalFeedsForListing(listing.id);
          
          for (const feed of icalFeeds) {
            if (feed.is_active) {
              try {
                // Use the fetch-ical API to get the events
                const response = await fetch(`${url.origin}/api/fetch-ical`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    url: feed.url,
                    listingId: listing.id,
                    startDate,
                    endDate
                  })
                });
                
                if (!response.ok) {
                  console.error(`Error fetching iCal data for feed ${feed.id}:`, response.statusText);
                  continue;
                }
                
                const data = await response.json();
                
                // Track source details for reporting
                icalSourceDetails.push({
                  listing: listing.name,
                  feedId: feed.id,
                  feedName: feed.name,
                  eventsCount: data.events.length
                });
                
                // Process each event into check-in and check-out events
                data.events.forEach((event: any) => {
                  // Create check-in event
                  const checkInEventId = `checkin-${event.id}`;
                  icalEvents.push({
                    id: checkInEventId,
                    title: `Check-in: ${event.title}`,
                    start: new Date(event.start),
                    end: new Date(event.start),
                    listing: listing.name,
                    isCheckIn: true,
                    isCheckOut: false
                  });
                  
                  // Create check-out event
                  const checkOutEventId = `checkout-${event.id}`;
                  icalEvents.push({
                    id: checkOutEventId,
                    title: `Check-out: ${event.title}`,
                    start: new Date(event.end),
                    end: new Date(event.end),
                    listing: listing.name,
                    isCheckIn: false,
                    isCheckOut: true
                  });
                });
                
                icalsProcessed++;
              } catch (error) {
                console.error(`Error processing feed ${feed.id}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching iCal data:", error);
      }
    }
    
    // Fetch events as they would be seen by the calendar UI
    const apiResponse = await fetch(`${url.origin}/api/booking-events?startDate=${startDate}&endDate=${endDate}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!apiResponse.ok) {
      return NextResponse.json({
        success: false,
        error: "Failed to fetch events from the calendar API",
        status: apiResponse.status,
        recommendation: "Check the /api/booking-events endpoint"
      }, { status: 500 });
    }
    
    const apiData = await apiResponse.json();
    const calendarEvents = apiData.events || [];
    
    // Normalize and sort the events for comparison
    const normalizedDbEvents: NormalizedEvent[] = dbEvents.map((event: any) => normalizeEvent(event, 'database'));
    const normalizedCalendarEvents: NormalizedEvent[] = calendarEvents.map((event: any) => normalizeEvent(event, 'calendar'));
    
    // Normalize iCal events if we have them
    const normalizedIcalEvents: NormalizedEvent[] = compareWithIcal ? icalEvents.map((event: any) => normalizeEvent(event, 'ical')) : [];

    // Sort the normalized events
    normalizedDbEvents.sort((a: NormalizedEvent, b: NormalizedEvent) => a.id.localeCompare(b.id));
    normalizedCalendarEvents.sort((a: NormalizedEvent, b: NormalizedEvent) => a.id.localeCompare(b.id));
    if (compareWithIcal) {
      normalizedIcalEvents.sort((a: NormalizedEvent, b: NormalizedEvent) => a.id.localeCompare(b.id));
    }

    // Find differences between the datasets
    const dbEventIds = new Set(normalizedDbEvents.map((e: NormalizedEvent) => e.id));
    const calendarEventIds = new Set(normalizedCalendarEvents.map((e: NormalizedEvent) => e.id));
    const icalEventIds = compareWithIcal ? new Set(normalizedIcalEvents.map((e: NormalizedEvent) => e.id)) : new Set();
    
    // Events in DB but not in calendar
    const missingFromCalendar = normalizedDbEvents.filter((e: NormalizedEvent) => !calendarEventIds.has(e.id));
    
    // Events in calendar but not in DB (shouldn't happen in normal operation)
    const extraInCalendar = normalizedCalendarEvents.filter((e: NormalizedEvent) => !dbEventIds.has(e.id));
    
    // If comparing with iCal, check for events in iCal but not in DB
    const missingFromDb = compareWithIcal ? 
      normalizedIcalEvents.filter((e: NormalizedEvent) => !dbEventIds.has(e.id)) : [];
    
    // Events in DB but not in the original iCal feeds
    const extraInDb = compareWithIcal ? 
      normalizedDbEvents.filter((e: NormalizedEvent) => !icalEventIds.has(e.id)) : [];
    
    // Count events by type for detailed reporting
    const eventCounts: {
      database: { total: number; checkIns: number; checkOuts: number; };
      calendar: { total: number; checkIns: number; checkOuts: number; };
      ical?: { total: number; checkIns: number; checkOuts: number; };
    } = {
      database: {
        total: normalizedDbEvents.length,
        checkIns: normalizedDbEvents.filter((e: NormalizedEvent) => e.isCheckIn).length,
        checkOuts: normalizedDbEvents.filter((e: NormalizedEvent) => e.isCheckOut).length
      },
      calendar: {
        total: normalizedCalendarEvents.length,
        checkIns: normalizedCalendarEvents.filter((e: NormalizedEvent) => e.isCheckIn).length,
        checkOuts: normalizedCalendarEvents.filter((e: NormalizedEvent) => e.isCheckOut).length
      }
    };
    
    // Add iCal event counts if available
    if (compareWithIcal) {
      eventCounts.ical = {
        total: normalizedIcalEvents.length,
        checkIns: normalizedIcalEvents.filter((e: NormalizedEvent) => e.isCheckIn).length,
        checkOuts: normalizedIcalEvents.filter((e: NormalizedEvent) => e.isCheckOut).length
      };
    }
    
    // Calculate listings with events in each dataset
    const dbListings = [...new Set(normalizedDbEvents.map((e: NormalizedEvent) => e.listing))];
    const calendarListings = [...new Set(normalizedCalendarEvents.map((e: NormalizedEvent) => e.listing))];
    
    // Find imbalanced listings in database events
    const imbalancedListings = findImbalancedListings(normalizedDbEvents);

    // Prepare the validation result
    const isValid = missingFromCalendar.length === 0 && extraInCalendar.length === 0;
    const isBalanced = imbalancedListings.length === 0;
    
    const recommendations = [];
    
    if (!isValid) {
      recommendations.push("Run a new sync to ensure calendar data is up to date");
      recommendations.push("Check if the date range used in the calendar view matches the test date range");
      recommendations.push("Verify that calendar events are being properly loaded from the API");
    } else {
      recommendations.push("The calendar is correctly displaying all events from the database");
    }
    
    if (!isBalanced) {
      recommendations.push("Investigate listings with imbalanced check-ins and check-outs");
      recommendations.push("Run a full sync to ensure all events are properly processed");
    }
    
    if (compareWithIcal && (missingFromDb.length > 0 || extraInDb.length > 0)) {
      recommendations.push("Run a sync to reconcile differences between iCal feeds and database");
    }
    
    // Track iCal source information
    const icalSources = {
      feedsProcessed: icalsProcessed,
      sources: icalSourceDetails.map(source => ({
        listing: source.listing,
        feedName: source.feedName,
        eventsCount: source.eventsCount
      })).filter(source => source.eventsCount > 0)
    };
    
    return NextResponse.json({
      success: true,
      isValid,
      isBalanced,
      lastSyncTime: latestSync.last_sync_time,
      syncStatus: latestSync.status,
      eventCounts,
      imbalancedListings: imbalancedListings.length > 0 ? imbalancedListings : null,
      differences: {
        missingFromCalendar: missingFromCalendar.length,
        extraInCalendar: extraInCalendar.length,
        listingsMissingEvents: dbListings.filter(listing => 
          normalizedDbEvents.filter((e: NormalizedEvent) => e.listing === listing).length > 
          normalizedCalendarEvents.filter((e: NormalizedEvent) => e.listing === listing).length
        ),
        ...(compareWithIcal && {
          missingFromDb: missingFromDb.length,
          extraInDb: extraInDb.length
        })
      },
      // Include sample of the first few differences for debugging
      samples: {
        missingFromCalendar: missingFromCalendar.slice(0, 5),
        extraInCalendar: extraInCalendar.slice(0, 5),
        ...(compareWithIcal && {
          missingFromDb: missingFromDb.slice(0, 5),
          extraInDb: extraInDb.slice(0, 5)
        })
      },
      dateRange: {
        startDate,
        endDate
      },
      icalSources,
      recommendations
    });
  } catch (error) {
    console.error('Error validating sync:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 