import { NextResponse } from 'next/server';

// Helper function to parse iCal data
function parseICalData(icalData: string, listingName?: string) {
  const events: Array<{
    id: string, 
    title: string, 
    start: string, 
    end: string, 
    listing: string
  }> = [];
  
  // Extract calendar name/listing name from the iCal feed
  let detectedListingName = listingName || 'Unknown Listing';
  const calendarNameMatch = icalData.match(/X-WR-CALNAME:(.+?)(?:\r\n|\n)/);
  if (calendarNameMatch && calendarNameMatch[1]) {
    detectedListingName = calendarNameMatch[1].trim();
  }
  
  // Basic parsing of iCal format
  const eventBlocks = icalData.split('BEGIN:VEVENT');
  
  // Skip the first element as it's the header
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i];
    
    // Extract event details
    const summary = block.match(/SUMMARY:(.*?)(?:\r\n|\n)/)?.[1] || 'Reserved';
    const dtstart = block.match(/DTSTART(?:;VALUE=DATE)?:(.*?)(?:\r\n|\n)/)?.[1];
    const dtend = block.match(/DTEND(?:;VALUE=DATE)?:(.*?)(?:\r\n|\n)/)?.[1];
    const uid = block.match(/UID:(.*?)(?:\r\n|\n)/)?.[1] || `event-${i}`;
    
    if (dtstart && dtend) {
      try {
        // Parse dates - format could be YYYYMMDD or YYYYMMDDTHHMMSSZ
        let startDate: Date, endDate: Date;
        
        if (dtstart.includes('T')) {
          // If date includes time
          startDate = new Date(
            parseInt(dtstart.slice(0, 4)),
            parseInt(dtstart.slice(4, 6)) - 1,
            parseInt(dtstart.slice(6, 8)),
            parseInt(dtstart.slice(9, 11)),
            parseInt(dtstart.slice(11, 13)),
            parseInt(dtstart.slice(13, 15))
          );
          
          endDate = new Date(
            parseInt(dtend.slice(0, 4)),
            parseInt(dtend.slice(4, 6)) - 1,
            parseInt(dtend.slice(6, 8)),
            parseInt(dtend.slice(9, 11)),
            parseInt(dtend.slice(11, 13)),
            parseInt(dtend.slice(13, 15))
          );
        } else {
          // If date only
          startDate = new Date(
            parseInt(dtstart.slice(0, 4)),
            parseInt(dtstart.slice(4, 6)) - 1,
            parseInt(dtstart.slice(6, 8))
          );
          
          endDate = new Date(
            parseInt(dtend.slice(0, 4)),
            parseInt(dtend.slice(4, 6)) - 1,
            parseInt(dtend.slice(6, 8))
          );
        }
        
        events.push({
          id: uid,
          title: summary,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          listing: detectedListingName
        });
      } catch (dateError) {
        console.error('Error parsing date in iCal event:', dateError);
        // Continue to next event
      }
    }
  }
  
  return { 
    events, 
    detectedListingName,
    eventCount: events.length 
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