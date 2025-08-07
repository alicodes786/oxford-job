'use client';

import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Event {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  feedName: string;
  feedColor: string;
  listingName?: string;
}

interface DatabaseEvent {
  uuid: string;
  event_id: string;
  listing_name: string;
  checkin_date: string;
  checkout_date: string;
  checkout_type: string;
}

interface ComparisonEvent {
  listing_name: string;
  checkout_type: string;
  event_id?: string;
  source: 'ical' | 'database';
}

interface ComparisonData {
  [date: string]: {
    ical: ComparisonEvent[];
    database: ComparisonEvent[];
    inSync: boolean;
  };
}

interface Listing {
  id: string;
  name: string;
}

const ALL_LISTINGS = 'all';

export default function ICalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  
  // Comparison functionality state
  const [databaseEvents, setDatabaseEvents] = useState<DatabaseEvent[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData>({});
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    if (selectedListingId) {
      if (selectedListingId === ALL_LISTINGS) {
        fetchAllListingsEvents();
      } else {
        fetchEvents(selectedListingId);
      }
    }
  }, [selectedListingId]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select('id, name')
        .order('name');

      if (listingsError) throw listingsError;

      setListings(listingsData || []);
      // Set to "All Listings" by default
      setSelectedListingId(ALL_LISTINGS);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setError('Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllListingsEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      setEvents([]); // Clear existing events

      // Fetch events for all listings in parallel
      const allEventsPromises = listings.map(async (listing) => {
        try {
          const response = await fetch(`/api/ical?listingId=${listing.id}`);
          if (!response.ok) {
            console.error(`Failed to fetch events for listing ${listing.name}`);
            return [];
          }
          const data = await response.json();
          // Filter out "Not available" events immediately after fetching
          const filteredEvents = (data.events || []).filter((event: Event) => event.title !== 'Airbnb (Not available)');
          // Add listing name to each filtered event
          return filteredEvents.map((event: Event) => ({
            ...event,
            listingName: listing.name
          }));
        } catch (error) {
          console.error(`Error fetching events for listing ${listing.name}:`, error);
          return [];
        }
      });

      const allEventsArrays = await Promise.all(allEventsPromises);
      const combinedEvents = allEventsArrays.flat();
      setEvents(combinedEvents);
    } catch (error) {
      console.error('Error fetching all events:', error);
      setError('Failed to load some events');
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async (listingId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/ical?listingId=${listingId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch calendar data');
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      // Filter out "Not available" events immediately after fetching
      const filteredEvents = (data.events || []).filter((event: Event) => event.title !== 'Airbnb (Not available)');
      // Add listing name to filtered events when viewing a single listing
      const listing = listings.find(l => l.id === listingId);
      const eventsWithListing = filteredEvents.map((event: Event) => ({
        ...event,
        listingName: listing?.name
      }));
      setEvents(eventsWithListing);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError(error instanceof Error ? error.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Comparison functionality functions
  const fetchDatabaseEvents = async () => {
    try {
      // Use a more conservative date filter - include events from yesterday onwards
      // to account for timezone differences and ensure we don't miss events
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      // Set upper limit to 6 months from today
      const sixMonthsFromToday = new Date();
      sixMonthsFromToday.setMonth(sixMonthsFromToday.getMonth() + 6);
      sixMonthsFromToday.setHours(23, 59, 59, 999);
      
      console.log('Fetching database events from:', yesterday.toISOString());
      console.log('Up to:', sixMonthsFromToday.toISOString());
      
      const { data: dbEvents, error } = await supabase
        .from('events')
        .select('uuid, event_id, listing_name, checkin_date, checkout_date, checkout_type')
        .eq('event_type', 'ical')
        .eq('is_active', true)
        .gte('checkout_date', yesterday.toISOString())
        .lte('checkout_date', sixMonthsFromToday.toISOString())
        .order('checkout_date');

      if (error) throw error;
      
      console.log('Raw database events fetched:', dbEvents?.length || 0);
      if (dbEvents && dbEvents.length > 0) {
        console.log('Sample database events:', dbEvents.slice(0, 3));
      }
      
      // Filter to only include events from TODAY onwards (not yesterday) and within 6 months
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filteredEvents = (dbEvents || []).filter(event => {
        const checkoutDate = new Date(event.checkout_date);
        return checkoutDate >= today && checkoutDate <= sixMonthsFromToday;
      });
      
      console.log('Filtered database events (today to 6 months):', filteredEvents.length);
      
      setDatabaseEvents(filteredEvents);
      return filteredEvents;
    } catch (error) {
      console.error('Error fetching database events:', error);
      return [];
    }
  };

  const determineCheckoutType = (event: Event, allEvents: Event[]): string => {
    const checkoutDate = new Date(event.end).toISOString().split('T')[0];
    const listingName = event.listingName || event.feedName;
    
    // Check if there's a same-day check-in for this listing
    const sameDayCheckin = allEvents.find(e => {
      const checkinDate = new Date(e.start).toISOString().split('T')[0];
      const eventListingName = e.listingName || e.feedName;
      return checkinDate === checkoutDate && eventListingName === listingName && e.id !== event.id;
    });
    
    return sameDayCheckin ? 'same_day' : 'open';
  };

  const createComparisonData = async () => {
    setComparisonLoading(true);
    
    try {
      // Fetch database events
      const dbEvents = await fetchDatabaseEvents();
      
      // Get current events (from iCal feeds) and filter to today + 6 months
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const sixMonthsFromToday = new Date();
      sixMonthsFromToday.setMonth(sixMonthsFromToday.getMonth() + 6);
      sixMonthsFromToday.setHours(23, 59, 59, 999);
      
      const filteredIcalEvents = events.filter(event => {
        const checkoutDate = new Date(event.end);
        return checkoutDate >= today && checkoutDate <= sixMonthsFromToday;
      });
      
      console.log('Creating comparison with:');
      console.log('- iCal events (filtered):', filteredIcalEvents.length, 'of', events.length, 'total');
      console.log('- Database events:', dbEvents.length);
      console.log('- Date range: Today to', sixMonthsFromToday.toDateString());
      
      const comparison: ComparisonData = {};
      
      // Process iCal events
      filteredIcalEvents.forEach(event => {
        const checkoutDate = format(new Date(event.end), 'dd/MM/yyyy');
        const listingName = event.listingName || event.feedName;
        const checkoutType = determineCheckoutType(event, filteredIcalEvents);
        
        if (!comparison[checkoutDate]) {
          comparison[checkoutDate] = {
            ical: [],
            database: [],
            inSync: true
          };
        }
        
        comparison[checkoutDate].ical.push({
          listing_name: listingName,
          checkout_type: checkoutType,
          event_id: event.id,
          source: 'ical'
        });
      });
      
      // Process database events
      dbEvents.forEach(event => {
        const checkoutDate = format(new Date(event.checkout_date), 'dd/MM/yyyy');
        
        console.log('Processing DB event:', {
          listing: event.listing_name,
          checkoutDate: checkoutDate,
          originalDate: event.checkout_date
        });
        
        if (!comparison[checkoutDate]) {
          comparison[checkoutDate] = {
            ical: [],
            database: [],
            inSync: true
          };
        }
        
        comparison[checkoutDate].database.push({
          listing_name: event.listing_name,
          checkout_type: event.checkout_type,
          event_id: event.event_id,
          source: 'database'
        });
      });
      
      console.log('Final comparison data:', comparison);
      
      // Determine sync status for each date
      Object.keys(comparison).forEach(date => {
        const { ical, database } = comparison[date];
        
        // Sort both arrays for comparison
        const sortedIcal = [...ical].sort((a, b) => a.listing_name.localeCompare(b.listing_name));
        const sortedDatabase = [...database].sort((a, b) => a.listing_name.localeCompare(b.listing_name));
        
        // Check if arrays are equal
        comparison[date].inSync = 
          sortedIcal.length === sortedDatabase.length &&
          sortedIcal.every((icalEvent, index) => {
            const dbEvent = sortedDatabase[index];
            return (
              icalEvent.listing_name === dbEvent.listing_name &&
              icalEvent.checkout_type === dbEvent.checkout_type
            );
          });
      });
      
      setComparisonData(comparison);
    } catch (error) {
      console.error('Error creating comparison data:', error);
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleTestSync = async () => {
    await createComparisonData();
    setShowComparison(true);
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const isCheckIn = (date: Date, event: Event) => {
    return isSameDay(date, new Date(event.start));
  };

  const isCheckOut = (date: Date, event: Event) => {
    return isSameDay(date, new Date(event.end));
  };

  // Add this function to check for same-day checkout/checkin
  const hasSameDayCheckInOut = (day: Date, events: Event[]) => {
    const checkouts = events.filter(event => isCheckOut(day, event));
    const checkins = events.filter(event => isCheckIn(day, event));
    
    // Check if any listing has both a checkout and checkin on this day
    return checkouts.some(checkout => 
      checkins.some(checkin => 
        checkout.listingName === checkin.listingName
      )
    );
  };

  const formatEventDate = (date: string) => {
    return format(new Date(date), 'EEE, MMM d, yyyy');
  };

  const getEventPair = (events: Event[], currentEvent: Event) => {
    if (isCheckIn(new Date(currentEvent.start), currentEvent)) {
      // For check-ins, find the corresponding check-out
      return events.find(e => 
        e.listingName === currentEvent.listingName && 
        isCheckOut(new Date(currentEvent.start), e)
      );
    } else {
      // For check-outs, find the corresponding check-in
      return events.find(e => 
        e.listingName === currentEvent.listingName && 
        isCheckIn(new Date(currentEvent.end), e)
      );
    }
  };

  const renderEventTooltip = (event: Event & { displayName: string }, pairedEvent: Event | undefined) => {
    const isCheckInEvent = event.start === event.end ? false : true;
    return (
      <div className="text-sm">
        <p className="font-semibold mb-1">{event.displayName}</p>
        <div className="space-y-1">
          <p>Check-in: {formatEventDate(isCheckInEvent ? event.start : (pairedEvent?.start || event.start))}</p>
          <p>Check-out: {formatEventDate(isCheckInEvent ? (pairedEvent?.end || event.end) : event.end)}</p>
        </div>
      </div>
    );
  };

  const renderEvents = (day: Date, events: Event[]) => {
    // Get all events for this day
    const dayEvents = events.reduce((acc, event) => {
      const listingName = event.listingName || event.feedName;
      
      if (isCheckOut(day, event)) {
        acc.checkouts.push({ ...event, displayName: listingName });
      }
      if (isCheckIn(day, event)) {
        acc.checkins.push({ ...event, displayName: listingName });
      }
      return acc;
    }, { 
      checkouts: [] as (Event & { displayName: string })[], 
      checkins: [] as (Event & { displayName: string })[] 
    });

    // Sort both arrays by listing name
    dayEvents.checkouts.sort((a, b) => a.displayName.localeCompare(b.displayName));
    dayEvents.checkins.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Create a map of listings with quick turnarounds
    const quickTurnaroundListings = new Set(
      dayEvents.checkouts
        .filter(checkout => 
          dayEvents.checkins.some(checkin => 
            checkin.displayName === checkout.displayName
          )
        )
        .map(event => event.displayName)
    );

    // Split checkouts into quick turnarounds and regular checkouts
    const quickTurnarounds = dayEvents.checkouts.filter(event => 
      quickTurnaroundListings.has(event.displayName)
    );
    const regularCheckouts = dayEvents.checkouts.filter(event => 
      !quickTurnaroundListings.has(event.displayName)
    );

    // Filter out check-ins that are already covered by quick turnarounds
    const standaloneCheckins = dayEvents.checkins.filter(event =>
      !quickTurnaroundListings.has(event.displayName)
    );

    return (
      <>
        {/* Render quick turnarounds first */}
        <div className="space-y-1 mb-1">
          {quickTurnarounds.map((event, index) => (
            <TooltipProvider key={`quick-${event.id}-${index}`}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Card 
                    className="p-2 text-xs hover:opacity-80 transition-opacity cursor-default"
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.1)', // purple-100
                      borderRight: '3px solid rgb(168, 85, 247)' // purple-500
                    }}
                  >
                    {event.displayName}
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  {renderEventTooltip(event, getEventPair(events, event))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Then render regular checkouts */}
        <div className="space-y-1 mb-2">
          {regularCheckouts.map((event, index) => (
            <TooltipProvider key={`checkout-${event.id}-${index}`}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Card 
                    className="p-2 text-xs hover:opacity-80 transition-opacity cursor-default"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue-100
                      borderRight: '3px solid rgb(59, 130, 246)' // blue-500
                    }}
                  >
                    {event.displayName}
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  {renderEventTooltip(event, getEventPair(events, event))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Finally render standalone check-ins (not covered by quick turnarounds) */}
        <div className="space-y-1">
          {standaloneCheckins.map((event, index) => (
            <TooltipProvider key={`checkin-${event.id}-${index}`}>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <Card 
                    className="p-2 text-xs hover:opacity-80 transition-opacity cursor-default"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.1)', // green-100
                      borderLeft: '3px solid rgb(34, 197, 94)' // green-500
                    }}
                  >
                    {event.displayName}
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  {renderEventTooltip(event, getEventPair(events, event))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </>
    );
  };

  if (loading && !selectedListingId) {
    return (
      <div className="container mx-auto p-4 text-center">
        Loading listings...
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 text-center text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="w-[200px]">
          <Select
            value={selectedListingId || undefined}
            onValueChange={(value) => setSelectedListingId(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a listing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_LISTINGS}>All Listings</SelectItem>
              {listings.map((listing) => (
                <SelectItem key={listing.id} value={listing.id}>
                  {listing.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Loading calendar...</div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-4">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center font-semibold p-2">
                {day}
              </div>
            ))}
            
            {daysInWeek.map((day) => (
              <div
                key={day.toISOString()}
                className="min-h-[120px] border rounded-lg p-2"
              >
                <div className="text-sm mb-2">{format(day, 'd MMM')}</div>
                {renderEvents(day, events)}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Previous Week
            </button>
            <button
              onClick={() => setCurrentWeek(new Date())}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Next Week
            </button>
          </div>

          {/* Comparison Section */}
          <div className="mt-8 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Event Sync Comparison</h2>
              <Button 
                onClick={handleTestSync}
                disabled={comparisonLoading || events.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {comparisonLoading ? 'Testing...' : 'Test Sync'}
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Compare events from iCal feeds with events stored in the database. 
              Shows events with checkout dates from today up to 6 months in the future.
            </p>

            {showComparison && Object.keys(comparisonData).length > 0 && (
              <div className="space-y-4">
                <div className="text-sm font-medium">
                  Events comparison by checkout date:
                </div>
                
                {Object.entries(comparisonData)
                  .sort(([a], [b]) => {
                    // Sort by date
                    const dateA = new Date(a.split('/').reverse().join('-'));
                    const dateB = new Date(b.split('/').reverse().join('-'));
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map(([date, data]) => {
                    // Create a comprehensive comparison for this date
                    const allListings = new Set([
                      ...data.ical.map(e => e.listing_name),
                      ...data.database.map(e => e.listing_name)
                    ]);
                    
                    const comparisonRows = Array.from(allListings).sort().map(listing => {
                      const icalEvent = data.ical.find(e => e.listing_name === listing);
                      const dbEvent = data.database.find(e => e.listing_name === listing);
                      
                      let status = 'match';
                      let issue = '';
                      
                      if (!icalEvent && dbEvent) {
                        status = 'missing-ical';
                        issue = 'Missing in iCal feed';
                      } else if (icalEvent && !dbEvent) {
                        status = 'missing-db';
                        issue = 'Missing in database';
                      } else if (icalEvent && dbEvent && icalEvent.checkout_type !== dbEvent.checkout_type) {
                        status = 'mismatch';
                        issue = `Checkout type mismatch: iCal="${icalEvent.checkout_type}" vs DB="${dbEvent.checkout_type}"`;
                      }
                      
                      return {
                        listing,
                        icalEvent,
                        dbEvent,
                        status,
                        issue
                      };
                    });
                    
                    return (
                      <Card key={date} className={`p-4 ${data.inSync ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{date}</h3>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            data.inSync 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {data.inSync ? '✓ In Sync' : '✗ Out of Sync'}
                          </div>
                        </div>
                        
                        {/* Header row */}
                        <div className="grid grid-cols-4 gap-2 mb-2 text-xs font-semibold bg-gray-100 p-2 rounded">
                          <div>Listing</div>
                          <div className="text-blue-700">iCal Feed</div>
                          <div className="text-green-700">Database</div>
                          <div className="text-red-700">Status</div>
                        </div>
                        
                        {/* Comparison rows */}
                        <div className="space-y-1">
                          {comparisonRows.map((row, index) => (
                            <div 
                              key={index} 
                              className={`grid grid-cols-4 gap-2 p-2 rounded text-xs ${
                                row.status === 'match' ? 'bg-green-50 border border-green-200' :
                                row.status === 'missing-ical' ? 'bg-red-50 border border-red-200' :
                                row.status === 'missing-db' ? 'bg-yellow-50 border border-yellow-200' :
                                'bg-orange-50 border border-orange-200'
                              }`}
                            >
                              {/* Listing name */}
                              <div className="font-medium">{row.listing}</div>
                              
                              {/* iCal event */}
                              <div className={`${!row.icalEvent ? 'text-red-500 italic' : 'text-blue-600'}`}>
                                {row.icalEvent ? (
                                  <div>
                                    <div>Type: {row.icalEvent.checkout_type}</div>
                                    <div className="text-gray-500">ID: {row.icalEvent.event_id}</div>
                                  </div>
                                ) : (
                                  'Missing'
                                )}
                              </div>
                              
                              {/* Database event */}
                              <div className={`${!row.dbEvent ? 'text-red-500 italic' : 'text-green-600'}`}>
                                {row.dbEvent ? (
                                  <div>
                                    <div>Type: {row.dbEvent.checkout_type}</div>
                                    <div className="text-gray-500">ID: {row.dbEvent.event_id}</div>
                                  </div>
                                ) : (
                                  'Missing'
                                )}
                              </div>
                              
                              {/* Status */}
                              <div className={`font-medium ${
                                row.status === 'match' ? 'text-green-600' :
                                row.status === 'missing-ical' ? 'text-red-600' :
                                row.status === 'missing-db' ? 'text-yellow-600' :
                                'text-orange-600'
                              }`}>
                                {row.status === 'match' ? '✓ Match' :
                                 row.status === 'missing-ical' ? '✗ Missing in iCal' :
                                 row.status === 'missing-db' ? '⚠ Missing in DB' :
                                 '⚠ Type Mismatch'}
                                {row.issue && (
                                  <div className="text-xs text-gray-600 mt-1">{row.issue}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Summary */}
                        <div className="mt-3 pt-2 border-t text-xs text-gray-600">
                          <div className="flex gap-4">
                            <span>Total iCal: {data.ical.length}</span>
                            <span>Total DB: {data.database.length}</span>
                            <span>Matches: {comparisonRows.filter(r => r.status === 'match').length}</span>
                            <span>Issues: {comparisonRows.filter(r => r.status !== 'match').length}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
            
            {showComparison && Object.keys(comparisonData).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No events found for comparison
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
} 