import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ICalFeed {
  ical_feed_id: string;
  ical_feeds: {
    url: string;
    name: string;
    color: string | null;
  };
}

interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
}

export async function GET(request: Request) {
  try {
    // Get the listing ID from the query params
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get('listingId');

    if (!listingId) {
      return NextResponse.json({ error: 'Listing ID is required' }, { status: 400 });
    }

    // Fetch all iCal feeds for the listing
    const { data: icalFeeds, error: feedsError } = await supabase
      .from('listing_ical_feeds')
      .select(`
        ical_feed_id,
        ical_feeds!inner (
          url,
          name,
          color
        )
      `)
      .eq('listing_id', listingId);

    if (feedsError || !icalFeeds) {
      console.error('Error fetching iCal feeds:', feedsError);
      return NextResponse.json({ error: 'Failed to fetch iCal feeds' }, { status: 500 });
    }

    // Type assertion after validation
    const typedFeeds = icalFeeds as unknown as ICalFeed[];

    // Fetch and parse all iCal feeds
    const allEvents = await Promise.all(
      typedFeeds.map(async (feed) => {
        try {
          const response = await fetch(feed.ical_feeds.url);
          const data = await response.text();
          const events = parseICalData(data);
          
          // Add feed information to each event
          return events.map(event => ({
            ...event,
            feedName: feed.ical_feeds.name,
            feedColor: feed.ical_feeds.color || '#000000'
          }));
        } catch (error) {
          console.error(`Error fetching feed ${feed.ical_feeds.name}:`, error);
          return [];
        }
      })
    );

    // Flatten all events into a single array
    const events = allEvents.flat();
    
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error in iCal API:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 });
  }
}

function parseICalData(icalData: string): Event[] {
  const events: Event[] = [];
  const lines = icalData.split('\n');
  let currentEvent: Partial<Event> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end && currentEvent.id) {
        events.push(currentEvent as Event);
      }
      currentEvent = {};
    } else if (currentEvent) {
      if (line.startsWith('DTSTART')) {
        currentEvent.start = parseICalDate(line.split(':')[1]);
      } else if (line.startsWith('DTEND')) {
        currentEvent.end = parseICalDate(line.split(':')[1]);
      } else if (line.startsWith('UID')) {
        currentEvent.id = line.split(':')[1];
      } else if (line.startsWith('SUMMARY')) {
        currentEvent.title = line.split(':')[1] || 'Untitled Event';
      } else if (line.startsWith('DESCRIPTION')) {
        currentEvent.description = line.split(':')[1] || '';
      }
    }
  }

  return events;
}

function parseICalDate(dateStr: string) {
  // Handle different date formats
  let cleanDate = dateStr.trim();
  
  // Remove any timezone identifier if present
  if (cleanDate.includes('Z')) {
    cleanDate = cleanDate.replace('Z', '');
  }
  
  // Handle dates with or without time component
  if (cleanDate.includes('T')) {
    // Date with time
    const [datePart, timePart] = cleanDate.split('T');
    const year = datePart.substr(0, 4);
    const month = datePart.substr(4, 2);
    const day = datePart.substr(6, 2);
    const hour = timePart.substr(0, 2);
    const minute = timePart.substr(2, 2);
    const second = timePart.substr(4, 2);
    return new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )).toISOString();
  } else {
    // Date only
    const year = cleanDate.substr(0, 4);
    const month = cleanDate.substr(4, 2);
    const day = cleanDate.substr(6, 2);
    return new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    )).toISOString();
  }
} 