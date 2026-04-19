import { NextResponse } from 'next/server';

// Helper function to parse iCal date strings into Date objects
function parseICalDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    // Datetime format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
    const year  = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day   = parseInt(dateStr.slice(6, 8));
    const hour  = parseInt(dateStr.slice(9, 11));
    const min   = parseInt(dateStr.slice(11, 13));
    const sec   = parseInt(dateStr.slice(13, 15));

    if (dateStr.endsWith('Z')) {
      // Explicitly UTC — use Date.UTC to avoid local-timezone shift
      return new Date(Date.UTC(year, month, day, hour, min, sec));
    }
    // Local/floating time — treat as UTC for consistency
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
  // Date-only format: YYYYMMDD — treat as UTC midnight
  return new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(4, 6)) - 1,
    parseInt(dateStr.slice(6, 8))
  ));
}

// Helper function to parse iCal data
function parseICalData(icalData: string, listingName?: string) {
  // Unfold iCal lines (RFC 5545: continuation lines start with whitespace)
  const unfolded = icalData.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');

  // Extract calendar name/listing name from the iCal feed
  let detectedListingName = listingName || 'Unknown Listing';
  const calendarNameMatch = unfolded.match(/X-WR-CALNAME:(.+?)(?:\r\n|\n)/);
  if (calendarNameMatch && calendarNameMatch[1]) {
    detectedListingName = calendarNameMatch[1].trim();
  }

  // Map of uid → { event, sequence } so we always keep the highest-sequence version.
  // Per RFC 5545, a higher SEQUENCE number means a newer update to the same event.
  const eventMap = new Map<string, {
    id: string;
    title: string;
    start: string;
    end: string;
    listing: string;
    sequence: number;
  }>();

  const eventBlocks = unfolded.split('BEGIN:VEVENT');

  // Skip the first element — it's the calendar header
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i];

    const summary  = block.match(/SUMMARY:(.*?)(?:\r\n|\n)/)?.[1]?.trim() || 'Reserved';
    const dtstart  = block.match(/DTSTART(?:;[^:]+)?:(.*?)(?:\r\n|\n)/)?.[1]?.trim();
    const dtend    = block.match(/DTEND(?:;[^:]+)?:(.*?)(?:\r\n|\n)/)?.[1]?.trim();
    const uid      = block.match(/UID:(.*?)(?:\r\n|\n)/)?.[1]?.trim() || `event-${i}`;
    const seqMatch = block.match(/SEQUENCE:(.*?)(?:\r\n|\n)/)?.[1]?.trim();
    const sequence = seqMatch ? parseInt(seqMatch, 10) : 0;

    if (!dtstart || !dtend) continue;

    try {
      const startDate = parseICalDate(dtstart);
      const endDate   = parseICalDate(dtend);

      const candidate = {
        id: uid,
        title: summary,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        listing: detectedListingName,
        sequence,
      };

      const existing = eventMap.get(uid);
      // Keep this version if: no existing entry, OR this one has a higher (or equal) SEQUENCE.
      // Equal sequence keeps the last occurrence, which is correct per iCal spec.
      if (!existing || sequence >= existing.sequence) {
        eventMap.set(uid, candidate);
      }
    } catch (dateError) {
      console.error('Error parsing date in iCal event:', dateError);
    }
  }

  // Strip internal `sequence` field before returning
  const events = Array.from(eventMap.values()).map(({ sequence: _seq, ...event }) => event);

  return {
    events,
    detectedListingName,
    eventCount: events.length,
  };
}

// Function to generate mock data for testing
function generateMockData(listingId?: string) {
  const today = new Date();
  const mockEvents = [
    {
      id: 'mock-1',
      title: 'Guest Booking - John Smith',
      start: today,
      end: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      listing: listingId
    },
    {
      id: 'mock-2',
      title: 'Guest Booking - Jane Doe',
      start: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      end: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      listing: listingId
    },
    {
      id: 'mock-3',
      title: 'Maintenance',
      start: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      end: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      listing: listingId
    }
  ];
  
  return mockEvents;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, startDate, endDate } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }
    
    // For now, use the hardcoded Airbnb URL if none is provided
    const icalUrl = url || 'https://www.airbnb.com/calendar/ical/658587657837235616.ics?s=3cf029c5a837b391a28061187820b06d&locale=en-GB';
    
    try {
      const response = await fetch(icalUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/calendar',
          'User-Agent': 'NextJS API Proxy',
        },
        cache: 'no-store',
        next: { revalidate: 0 }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const icalData = await response.text();
      const { events, detectedListingName, eventCount } = parseICalData(icalData);
      
      // Filter events by date range if provided
      let filteredEvents = events;
      let dateRangeApplied = false;
      
      if (startDate || endDate) {
        dateRangeApplied = true;
        const startDateTime = startDate ? new Date(startDate) : null;
        const endDateTime = endDate ? new Date(endDate) : null;
        
        filteredEvents = events.filter(event => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          
          // Check if event falls within the date range
          const afterStart = !startDateTime || eventEnd >= startDateTime;
          const beforeEnd = !endDateTime || eventStart <= endDateTime;
          
          return afterStart && beforeEnd;
        });
      }
      
      return NextResponse.json({ 
        events: filteredEvents,
        detectedListingName,
        eventCount: filteredEvents.length,
        originalEventCount: events.length,
        dateRangeApplied
      });
      
    } catch (error) {
      console.error('Error fetching iCal data:', error);
      return NextResponse.json(
        { 
          error: `Failed to fetch iCal data: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 