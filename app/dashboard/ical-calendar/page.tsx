'use client';

import { useState, useEffect } from 'react';
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';

interface IcalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  listing: string;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  source?: string;
}

function IcalCalendarContent() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [events, setEvents] = useState<IcalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Fetch iCal events
  useEffect(() => {
    fetchIcalEvents();
  }, []);

  const fetchIcalEvents = async () => {
    setIsLoading(true);
    try {
      // Calculate date range - 3 months back, 6 months ahead
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      
      const sixMonthsAhead = new Date(today);
      sixMonthsAhead.setMonth(today.getMonth() + 6);

      const response = await fetch('/api/ical-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startDate: threeMonthsAgo.toISOString(),
          endDate: sixMonthsAhead.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch iCal events');
      }

      const data = await response.json();
      
      // Transform the data into our event format
      const transformedEvents: IcalEvent[] = [];
      
      data.events.forEach((event: any) => {
        // Create check-in event
        transformedEvents.push({
          id: `checkin-${event.id}`,
          title: event.title || 'Booking',
          start: new Date(event.start),
          end: new Date(event.start),
          listing: event.listing,
          isCheckIn: true,
          isCheckOut: false,
          source: event.source
        });
        
        // Create check-out event
        transformedEvents.push({
          id: `checkout-${event.id}`,
          title: event.title || 'Booking',
          start: new Date(event.end),
          end: new Date(event.end),
          listing: event.listing,
          isCheckIn: false,
          isCheckOut: true,
          source: event.source
        });
      });
      
      setEvents(transformedEvents);
    } catch (error) {
      console.error('Error fetching iCal events:', error);
      toast.error('Failed to fetch iCal events');
    } finally {
      setIsLoading(false);
    }
  };

  // Get days for the current view (month or week)
  const getViewDays = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    } else {
      // Use Monday as start of week (1) instead of Sunday (0)
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };

  const days = getViewDays();
  
  // Change the week days header to start with Monday
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      try {
        return isSameDay(day, event.start);
      } catch (e) {
        console.error('Invalid date comparison:', e);
        return false;
      }
    });
  };

  // Get selected day events
  const selectedDayEvents = selectedDay 
    ? getEventsForDay(selectedDay)
    : [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-500">Loading iCal data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Raw iCal Calendar</h1>
          <p className="text-muted-foreground">
            Displays events directly from iCal feeds without database processing.
          </p>
        </div>
        <div>
          <Button 
            variant="outline"
            onClick={fetchIcalEvents}
            className="gap-2"
          >
            Refresh iCal Data
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium">
          {viewMode === 'month' 
            ? format(currentDate, 'MMMM yyyy')
            : `Week of ${format(days[0], 'MMM d')} - ${format(days[days.length-1], 'MMM d')}`
          }
        </h2>
        <div className="space-x-2 flex items-center">
          <div className="border rounded-md overflow-hidden flex">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-sm ${viewMode === 'week' ? 'bg-blue-100 font-medium border-blue-300' : 'hover:bg-gray-50'}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm ${viewMode === 'month' ? 'bg-gray-200' : 'hover:bg-gray-50'}`}
            >
              Month
            </button>
          </div>
          
          <button
            onClick={() => setCurrentDate(prev => {
              if (viewMode === 'week') {
                return addDays(prev, -7);
              } else {
                return addDays(prev, -30);
              }
            })}
            className="p-1 border rounded hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(prev => {
              if (viewMode === 'week') {
                return addDays(prev, 7);
              } else {
                return addDays(prev, 30);
              }
            })}
            className="p-1 border rounded hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden bg-white p-4">
        {/* Days of the week header */}
        <div className="grid grid-cols-7 border-b">
          {weekDays.map(day => (
            <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const checkIns = dayEvents.filter(event => event.isCheckIn);
            const checkOuts = dayEvents.filter(event => event.isCheckOut);
            const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
            
            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDay(day)}
                className={`
                  min-h-[100px] p-2 border-b border-r relative
                  ${isSelected ? 'bg-blue-50' : ''}
                  hover:bg-gray-50 cursor-pointer
                `}
              >
                <div className="text-sm font-medium mb-1 flex justify-between">
                  <span>{format(day, 'd')}</span>
                  {(checkIns.length > 0 || checkOuts.length > 0) && (
                    <span className="text-xs bg-gray-100 px-1 rounded-full">
                      {checkIns.length + checkOuts.length}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-col gap-1">
                  {/* Check-outs first */}
                  {checkOuts.map((event, idx) => (
                    <div 
                      key={`checkout-${event.id}-${idx}`}
                      className="text-xs px-1.5 py-1 rounded border-l-2 border-red-500 bg-red-50"
                    >
                      <div className="font-bold text-red-700 text-[10px]">
                        CHECK-OUT
                      </div>
                      <div className="font-medium truncate text-gray-800 text-[10px]">
                        {event.listing || 'Unnamed'}
                      </div>
                    </div>
                  ))}
                  
                  {/* Then check-ins */}
                  {checkIns.map((event, idx) => (
                    <div 
                      key={`checkin-${event.id}-${idx}`}
                      className="text-xs px-1.5 py-1 rounded border-l-2 border-green-500 bg-green-50"
                    >
                      <div className="font-bold text-green-700 text-[10px]">
                        CHECK-IN
                      </div>
                      <div className="font-medium truncate text-gray-800 text-[10px]">
                        {event.listing || 'Unnamed'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Selected day events detail */}
      {selectedDay && selectedDayEvents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-md font-medium mb-3">
              Events for {format(selectedDay, 'MMMM d, yyyy')}
            </h3>
            <div className="space-y-3">
              {/* Display check-outs first */}
              {selectedDayEvents.filter(event => event.isCheckOut).map((event, idx) => (
                <div 
                  key={`detail-checkout-${event.id}-${idx}`}
                  className="p-3 border rounded-md border-l-4 border-l-red-500 bg-red-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        {event.listing || 'Unnamed Listing'}
                      </div>
                      <div className="text-sm text-gray-600">{event.title}</div>
                      <div className="text-xs text-gray-500 mt-1">Source: {event.source || 'Unknown'}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-xs font-bold text-red-600 px-2 py-1 rounded">
                        CHECK-OUT
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Then display check-ins */}
              {selectedDayEvents.filter(event => event.isCheckIn).map((event, idx) => (
                <div 
                  key={`detail-checkin-${event.id}-${idx}`}
                  className="p-3 border rounded-md border-l-4 border-l-green-500 bg-green-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">
                        {event.listing || 'Unnamed Listing'}
                      </div>
                      <div className="text-sm text-gray-600">{event.title}</div>
                      <div className="text-xs text-gray-500 mt-1">Source: {event.source || 'Unknown'}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-xs font-bold text-green-600 px-2 py-1 rounded">
                        CHECK-IN
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          Total Events: {events.length} | 
          Check-ins: {events.filter(e => e.isCheckIn).length} | 
          Check-outs: {events.filter(e => e.isCheckOut).length}
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/dashboard/calendar'}
        >
          Back to Regular Calendar
        </Button>
      </div>
    </div>
  );
}

export default function IcalCalendarPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <IcalCalendarContent />
    </ProtectedRoute>
  );
} 