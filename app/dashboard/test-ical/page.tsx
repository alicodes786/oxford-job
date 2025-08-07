'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Calendar, Check, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProtectedRoute from '@/components/ProtectedRoute';
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';

// Predefined colors for better visibility and distinction
const EVENT_COLORS = [
  { bg: '#FFEBEE', text: '#C62828' }, // Red
  { bg: '#E3F2FD', text: '#1565C0' }, // Blue
  { bg: '#E8F5E9', text: '#2E7D32' }, // Green
  { bg: '#FFF3E0', text: '#EF6C00' }, // Orange
  { bg: '#F3E5F5', text: '#7B1FA2' }, // Purple
  { bg: '#E0F7FA', text: '#00838F' }, // Cyan
  { bg: '#FFF8E1', text: '#F9A825' }, // Yellow
  { bg: '#EFEBE9', text: '#4E342E' }, // Brown
  { bg: '#E8EAF6', text: '#283593' }, // Indigo
  { bg: '#FCE4EC', text: '#C2185B' }, // Pink
];

// Get color pair for an event
const getEventColor = (eventId: string) => {
  const index = Math.abs(hashString(eventId)) % EVENT_COLORS.length;
  return EVENT_COLORS[index];
};

// Simple string hash function
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
};

function TestIcalContent() {
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Format date for tooltip
  const formatDateForTooltip = (date: Date) => {
    return format(date, 'MMM d, yyyy h:mm a');
  };

  // Get paired event (check-in for checkout, vice versa)
  const getPairedEvent = (events: any[], currentEvent: any) => {
    return events.find(event => 
      event.uid === currentEvent.uid && event !== currentEvent
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      toast.error('Please enter an iCal URL');
      return;
    }
    
    // Clear previous results
    setError(null);
    setResponse(null);
    setIsLoading(true);
    
    try {
      // Use the existing fetch-ical API endpoint
      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch iCal data');
      }
      
      setResponse(data);
      toast.success(`Successfully fetched iCal data with ${data.events?.length || 0} events`);
    } catch (err) {
      console.error('Error fetching iCal:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to fetch iCal data'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to render a nice event preview
  const renderEvent = (event: any, index: number) => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    
    return (
      <Card key={index} className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-md font-medium">{event.title || 'Untitled Event'}</CardTitle>
          <CardDescription>
            {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <Label className="text-xs text-gray-500">Check-in</Label>
              <div>{startDate.toLocaleDateString()} {startDate.toLocaleTimeString()}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Check-out</Label>
              <div>{endDate.toLocaleDateString()} {endDate.toLocaleTimeString()}</div>
            </div>
            
            {event.uid && (
              <div className="col-span-2 mt-2">
                <Label className="text-xs text-gray-500">UID</Label>
                <div className="truncate text-xs">{event.uid}</div>
              </div>
            )}
            
            {event.description && (
              <div className="col-span-2 mt-2">
                <Label className="text-xs text-gray-500">Description</Label>
                <div className="text-xs whitespace-pre-line">{event.description}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">iCal Feed Tester</h1>
          <p className="text-muted-foreground">
            Test an iCal feed URL and inspect the parsed data.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Test an iCal URL</CardTitle>
            <CardDescription>
              Enter an iCal URL to fetch and parse the calendar data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="ical-url">iCal URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="ical-url"
                    placeholder="https://www.airbnb.com/calendar/ical/12345.ics"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Calendar className="mr-2 h-4 w-4" />
                        Fetch Calendar
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter any valid iCal URL from platforms like Airbnb, Booking.com, Vrbo, etc.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-600">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}
        
        {response && (
          <Tabs defaultValue="preview">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="raw">Raw Data</TabsTrigger>
              </TabsList>
              
              {response.detectedListingName && (
                <Badge className="ml-2 bg-blue-600">
                  Detected Name: {response.detectedListingName}
                </Badge>
              )}
            </div>
            
            <TabsContent value="preview">
              <Card>
                <CardHeader>
                  <CardTitle>Calendar Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      <span>Valid iCal Format</span>
                    </div>
                    <div className="flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-blue-600" />
                      <span>{response.events?.length || 0} Events Found</span>
                    </div>
                    {response.calendarName && (
                      <div className="flex items-center">
                        <ExternalLink className="mr-2 h-4 w-4 text-gray-600" />
                        <span>Calendar Name: {response.calendarName}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {response.events && response.events.length > 0 ? (
                <div>
                  <h3 className="text-lg font-medium mb-4">Events ({response.events.length})</h3>
                  <div className="space-y-4">
                    {response.events.slice(0, 10).map((event: any, index: number) => renderEvent(event, index))}
                    {response.events.length > 10 && (
                      <p className="text-center text-sm text-gray-500">
                        Showing 10 of {response.events.length} events. Switch to Raw Data to see all.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-gray-500">No events found in this calendar.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              <Card>
                <CardHeader>
                  <CardTitle>Calendar View</CardTitle>
                  <CardDescription>
                    View check-ins (red) and check-outs (green) in a calendar layout.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Calendar Controls */}
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium">
                        {viewMode === 'month' 
                          ? format(currentDate, 'MMMM yyyy')
                          : `Week of ${format(startOfWeek(currentDate), 'MMM d')} - ${format(endOfWeek(currentDate), 'MMM d')}`
                        }
                      </h2>
                      <div className="flex items-center space-x-2">
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
                          onClick={() => setCurrentDate(prev => addDays(prev, viewMode === 'week' ? -7 : -30))}
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
                          onClick={() => setCurrentDate(prev => addDays(prev, viewMode === 'week' ? 7 : 30))}
                          className="p-1 border rounded hover:bg-gray-50"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="border rounded-lg overflow-hidden">
                      {/* Days of the week header */}
                      <div className="grid grid-cols-7 bg-gray-50">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Calendar days */}
                      <div className="grid grid-cols-7">
                        {(() => {
                          const days = viewMode === 'month'
                            ? eachDayOfInterval({
                                start: startOfMonth(currentDate),
                                end: endOfMonth(currentDate)
                              })
                            : eachDayOfInterval({
                                start: startOfWeek(currentDate),
                                end: endOfWeek(currentDate)
                              });

                          // If month view, add empty cells for days before the 1st
                          const firstDay = days[0];
                          const emptyDays = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
                          
                          return (
                            <>
                              {viewMode === 'month' && Array.from({ length: emptyDays }).map((_, i) => (
                                <div key={`empty-${i}`} className="h-24 border-b border-r bg-gray-50" />
                              ))}
                              
                              {days.map(day => {
                                const dayEvents = response.events?.filter((event: any) => {
                                  const startDate = new Date(event.start);
                                  const endDate = new Date(event.end);
                                  return isSameDay(day, startDate) || isSameDay(day, endDate);
                                }) || [];

                                return (
                                  <div
                                    key={day.toISOString()}
                                    className="h-24 border-b border-r p-1 overflow-hidden"
                                  >
                                    <div className="text-sm mb-1">{format(day, 'd')}</div>
                                    <div className="space-y-1">
                                      {dayEvents.map((event: any, index: number) => {
                                        const isCheckIn = isSameDay(day, new Date(event.start));
                                        const eventId = event.uid || `${event.start}-${event.end}-${event.title}`;
                                        const { bg: backgroundColor, text: textColor } = getEventColor(eventId);
                                        
                                        // Get the paired event for tooltip
                                        const pairedEvent = getPairedEvent(response.events, event);
                                        const tooltipContent = `${event.title || 'Untitled Event'}
Check-in: ${formatDateForTooltip(new Date(event.start))}
Check-out: ${formatDateForTooltip(new Date(event.end))}`;
                                        
                                        return (
                                          <div
                                            key={`${eventId}-${index}`}
                                            className="text-xs truncate px-1 py-0.5 rounded border flex items-center gap-1 cursor-help"
                                            style={{
                                              backgroundColor,
                                              borderColor: textColor,
                                              color: textColor
                                            }}
                                            title={tooltipContent}
                                          >
                                            <span className="flex-shrink-0 font-bold">
                                              {isCheckIn ? '→' : '←'}
                                            </span>
                                            <span className="truncate">
                                              {event.title || 'Untitled'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Raw Response Data</CardTitle>
                  <CardDescription>
                    This is the raw data returned from the API.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[500px] text-xs">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default function TestIcalPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <TestIcalContent />
    </ProtectedRoute>
  );
} 