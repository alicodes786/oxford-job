'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfDay, endOfDay, isSameDay, formatDistanceToNow, parse, isValid } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Clock, Plus } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';
import { getListings } from '@/lib/models';
import { supabase } from '@/lib/supabase';
import SyncModal from '@/components/SyncModal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RecentEvents from '@/components/RecentEvents';
import JobCompletionNotifications from '@/components/JobCompletionNotifications';
import { Switch } from '@/components/ui/switch';

interface CalendarEvent {
  id: string;
  uuid: string;
  title: string;
  start: Date;
  end: Date;
  listing?: string;
  listingName?: string;
  color?: string;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  isSameDayCheckout?: boolean;
  checkoutTime?: string;
  checkoutType?: 'same_day' | 'open';
  guestName?: string;
  cleaner?: any;
  eventType?: string;
  listingHours?: number;
}

interface UniversalCalendarPageProps {
  hasAccess: boolean;
  noAccessMessage?: string;
  debugMode?: boolean;
}

export default function UniversalCalendarPage({ hasAccess, noAccessMessage, debugMode = false }: UniversalCalendarPageProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [listings, setListings] = useState<any[]>([]);
  const [selectedListingName, setSelectedListingName] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isManualEventDialogOpen, setIsManualEventDialogOpen] = useState(false);
  const [customListingName, setCustomListingName] = useState('');
  const [selectedListing, setSelectedListing] = useState<string>('');
  const [checkInDateStr, setCheckInDateStr] = useState('');
  const [checkOutDateStr, setCheckOutDateStr] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [listingHours, setListingHours] = useState('2');
  const [checkoutType, setCheckoutType] = useState<'same_day' | 'open'>('open');
  const [selectedCleaner, setSelectedCleaner] = useState<string>('none');
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [dateError, setDateError] = useState('');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  // Add recurrence fields
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDateStr, setRecurrenceEndDateStr] = useState('');

  useEffect(() => {
    if (hasAccess) {
      loadCalendarData();
    }
  }, [hasAccess, selectedListingName]);

  useEffect(() => {
    if (!hasAccess) return;
    const loadCleaners = async () => {
      try {
        const { data: cleanersData, error } = await supabase
          .from('cleaners')
          .select('*');
        if (error) {
          console.error('Supabase error loading cleaners:', error);
          toast.error(`Failed to load cleaners: ${error.message}`);
          return;
        }
        setCleaners(cleanersData || []);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error loading cleaners:', errorMessage);
        toast.error(`Failed to load cleaners: ${errorMessage}`);
      }
    };
    loadCleaners();
  }, [hasAccess]);

  const loadCalendarData = async () => {
    setIsLoadingData(true);
    try {
      const listingsData = await getListings();
      setListings(listingsData);
      const today = new Date();
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      const sixMonthsAhead = new Date(today);
      sixMonthsAhead.setMonth(today.getMonth() + 6);
      const startDate = threeMonthsAgo.toISOString();
      const endDate = sixMonthsAhead.toISOString();
      
      // First, get the current events to preserve cleaner assignments
      const currentEvents = [...events];
      const currentAssignments = new Map();
      currentEvents.forEach(event => {
        if (event.cleaner) {
          currentAssignments.set(event.uuid, event.cleaner);
        }
      });

      // Fetch new events
      const url = selectedListingName
        ? `/api/events?startDate=${startDate}&endDate=${endDate}&listingName=${selectedListingName}&includeAssignments=true`
        : `/api/events?startDate=${startDate}&endDate=${endDate}&includeAssignments=true`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.events && data.events.length > 0) {
          const formattedEvents = data.events.map((event: any) => ({
            ...event,
            start: new Date(event.start),
            end: new Date(event.end),
            isSameDayCheckout: event.checkoutType === 'same_day',
            cleaner: event.cleaner,
            eventType: event.eventType,
            listingHours: event.listingHours,
            uuid: event.uuid
          }));
          setEvents(formattedEvents);
          return formattedEvents;
        }
      }
      toast.info('No events found or error fetching events. Syncing calendars...');
      await syncCalendar();
      return [];
    } catch (error) {
      console.error('Error loading calendar data:', error);
      toast.error('Failed to load calendar data');
      return [];
    } finally {
      setIsLoadingData(false);
    }
  };

  const syncCalendar = async () => {
    if (isLoadingData) return;
    setIsLoadingData(true);
    toast.loading('Syncing your calendars...', { id: 'sync-calendars' });
    try {
      const response = await fetch('/api/sync-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync calendar data');
      }
      await loadCalendarData();
      setLastSyncTime(new Date().toISOString());
      toast.success(`Calendar synchronized successfully. Added: ${result.stats.added}, Updated: ${result.stats.updated}`, { id: 'sync-calendars' });
    } catch (error) {
      console.error('Error syncing calendars:', error);
      toast.error('Failed to sync your calendars', { id: 'sync-calendars' });
    } finally {
      setIsLoadingData(false);
    }
  };

  const refreshCalendar = async () => {
    console.log('📅 Refreshing calendar after sync...');
    await loadCalendarData();
    setLastSyncTime(new Date().toISOString());
    toast.success('Calendar refreshed successfully');
  };

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  };

  const handleManualEventCreate = async () => {
    try {
      const checkOutDate = parseDate(checkOutDateStr);
      if (!checkOutDateStr || !checkOutDate) {
        setDateError('Check-out date is required in dd/mm/yyyy format');
        return;
      }
      const checkInDate = checkInDateStr ? parseDate(checkInDateStr) : null;
      if (checkInDateStr && !checkInDate) {
        setDateError('Check-in date must be in dd/mm/yyyy format');
        return;
      }

      // Validate recurrence end date if recurring
      let recurrenceEndDate = null;
      if (isRecurring) {
        recurrenceEndDate = parseDate(recurrenceEndDateStr);
        if (!recurrenceEndDate) {
          setDateError('Recurrence end date is required in dd/mm/yyyy format');
          return;
        }
        // Ensure end date is after the checkout date
        if (recurrenceEndDate <= checkOutDate) {
          setDateError('Recurrence end date must be after the checkout date');
          return;
        }
      }

      const finalListingName = selectedListing === 'custom' ? customListingName : selectedListing;
      if (!finalListingName) {
        toast.error('Listing name is required');
        return;
      }

      // Create the listing first if it's a custom listing
      let listingId = null;
      if (selectedListing === 'custom') {
        const { data: newListing, error: listingError } = await supabase
          .from('listings')
          .insert({
            name: finalListingName,
            external_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            hours: parseFloat(listingHours),
            bank_account: selectedBankAccount || null
          })
          .select()
          .single();

        if (listingError) throw listingError;
        listingId = newListing.id;
      }

      // Generate a recurring series ID if this is a recurring event
      const recurringSeriesId = isRecurring ? crypto.randomUUID() : null;
      
      // Calculate all event dates if recurring
      const eventDates = [];
      if (isRecurring && recurrenceEndDate) {
        let currentDate = checkOutDate;
        while (currentDate <= recurrenceEndDate) {
          eventDates.push({
            checkIn: checkInDate ? addDays(checkInDate, eventDates.length * 7) : addDays(currentDate, -1),
            checkOut: currentDate
          });
          currentDate = addDays(currentDate, 7);
        }
      } else {
        eventDates.push({
          checkIn: checkInDate || addDays(checkOutDate, -1),
          checkOut: checkOutDate
        });
      }

      // Create events
      for (const dates of eventDates) {
        const eventId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert({
            event_id: eventId,
            uuid: crypto.randomUUID(),
            listing_name: finalListingName,
            listing_hours: listingHours,
            checkin_date: dates.checkIn.toISOString(),
            checkout_date: dates.checkOut.toISOString(),
            checkout_type: checkoutType,
            checkout_time: checkOutTime,
            event_type: 'manual',
            listing_id: listingId,
            recurring_series_id: recurringSeriesId,
            recurrence_type: isRecurring ? 'weekly' : null,
            recurrence_end_date: recurrenceEndDate?.toISOString() || null
          })
          .select()
          .single();

        if (eventError) throw eventError;

        if (selectedCleaner !== 'none' && eventData) {
          const { error: assignmentError } = await supabase
            .from('cleaner_assignments')
            .insert({
              event_uuid: eventData.uuid,
              cleaner_uuid: selectedCleaner,
              hours: parseFloat(listingHours)
            });
          if (assignmentError) throw assignmentError;
        }
      }

      toast.success(isRecurring ? 'Recurring events created successfully' : 'Manual event created successfully');
      setIsManualEventDialogOpen(false);
      loadCalendarData();
    } catch (error) {
      console.error('Error creating manual event:', error);
      toast.error('Failed to create manual event');
    }
  };

  const selectedListingObject = selectedListingName
    ? listings.find(listing => listing.name === selectedListingName)
    : null;
  const filteredEvents = selectedListingName
    ? events.filter(event => event.listingName === selectedListingName)
    : events;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              {noAccessMessage || 'You do not have permission to view the calendar.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500">If you believe this is a mistake, please contact your administrator.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6">
      <div className="space-y-4">
        {/* Mobile-optimized header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground">
              View and manage your bookings and cleaning schedule.
            </p>
          </div>
          
          {/* Mobile action buttons in a scrollable row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 -mx-2 px-2 md:mx-0 md:px-0">
            <Dialog open={isManualEventDialogOpen} onOpenChange={setIsManualEventDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="whitespace-nowrap">
                  <Plus className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Add Manual Event</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Create Manual Event</DialogTitle>
                  <DialogDescription>
                    Add a manual event to your calendar. These events won't be affected by calendar syncs.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Listing</Label>
                      <Select value={selectedListing} onValueChange={setSelectedListing}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a listing" />
                        </SelectTrigger>
                        <SelectContent>
                          {listings.map(listing => (
                            <SelectItem key={listing.id} value={listing.name}>
                              {listing.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom Listing Name</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedListing === 'custom' && (
                        <Input
                          placeholder="Enter custom listing name"
                          value={customListingName}
                          onChange={e => setCustomListingName(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Check-in Date (Optional)</Label>
                      <div className="flex flex-col gap-1">
                        <Input
                          placeholder="dd/mm/yyyy"
                          value={checkInDateStr}
                          onChange={e => {
                            setCheckInDateStr(e.target.value);
                            setDateError('');
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Check-out Date</Label>
                      <div className="flex flex-col gap-1">
                        <Input
                          placeholder="dd/mm/yyyy"
                          value={checkOutDateStr}
                          onChange={e => {
                            setCheckOutDateStr(e.target.value);
                            setDateError('');
                          }}
                        />
                        <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
                      </div>
                      {dateError && (
                        <span className="text-sm text-red-500">{dateError}</span>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Check-out Time</Label>
                      <Input
                        type="time"
                        value={checkOutTime}
                        onChange={e => setCheckOutTime(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Listing Hours</Label>
                      <Input
                        type="number"
                        value={listingHours}
                        onChange={e => setListingHours(e.target.value)}
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Checkout Type</Label>
                      <Select value={checkoutType} onValueChange={(value: 'same_day' | 'open') => setCheckoutType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="same_day">Same Day</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Assign Cleaner</Label>
                      <Select value={selectedCleaner} onValueChange={setSelectedCleaner}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Cleaner</SelectItem>
                          {cleaners.map(cleaner => (
                            <SelectItem key={cleaner.id} value={cleaner.id}>
                              {cleaner.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Add recurrence toggle */}
                    <div className="grid gap-2">
                      <Label>Recurrence</Label>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <Switch
                            checked={isRecurring}
                            onCheckedChange={setIsRecurring}
                            className="data-[state=checked]:bg-blue-500"
                          />
                          <span className="text-sm">Repeat Weekly</span>
                        </div>
                        
                        {isRecurring && (
                          <div className="flex-1">
                            <Label>End Date</Label>
                            <div className="flex flex-col gap-1 mt-1">
                              <Input
                                placeholder="dd/mm/yyyy"
                                value={recurrenceEndDateStr}
                                onChange={e => {
                                  setRecurrenceEndDateStr(e.target.value);
                                  setDateError('');
                                }}
                                className="w-full"
                              />
                              <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {dateError && (
                        <span className="text-sm text-red-500">{dateError}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsManualEventDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleManualEventCreate}>
                    Create Event
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSyncModal(true)}
              className="whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Sync Listings</span>
            </Button>
            
            {lastSyncTime && (
              <Badge variant="outline" className="hidden md:flex items-center gap-1 whitespace-nowrap">
                <Clock className="h-3 w-3" />
                Last sync: {formatDistanceToNow(new Date(lastSyncTime))} ago
              </Badge>
            )}
          </div>
        </div>

        {/* Mobile-optimized filters */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full flex items-center justify-between md:hidden"
            >
              <div className="flex items-center">
                <span className="font-semibold">Filters</span>
                {selectedListingName && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedListingName}
                  </Badge>
                )}
              </div>
              {filtersExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            
            <div className="hidden md:block">
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Filter events by listing and date range.
              </CardDescription>
            </div>
          </CardHeader>

          {/* Collapsible filter content */}
          {filtersExpanded && (
            <CardContent>
              <div className="space-y-4">
                {/* Mobile: Dropdown */}
                <div className="block md:hidden">
                  <div>
                    <Label>Listing</Label>
                    <Select
                      value={selectedListingName || 'all'}
                      onValueChange={(value) => setSelectedListingName(value === 'all' ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All listings" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All listings</SelectItem>
                        {listings.map((listing) => (
                          <SelectItem key={listing.id} value={listing.name}>
                            {listing.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Desktop: Buttons */}
                <div className="hidden md:block">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedListingName === null ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedListingName(null)}
                    >
                      All Listings
                    </Button>
                    {listings.map(listing => (
                      <Button
                        key={listing.id}
                        variant={selectedListingName === listing.name ? "default" : "outline"}
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => setSelectedListingName(listing.name)}
                      >
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: listing.color || '#888888' }}
                        />
                        {listing.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Main content with tabs */}
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="recent">Recent Events</TabsTrigger>
            <TabsTrigger value="notifications">Job Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>
                      Main Calendar View
                      {selectedListingObject && ` - ${selectedListingObject.name}`}
                    </CardTitle>
                    <CardDescription>
                      View check-in and check-out dates across your properties.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {listings.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p>No listings configured. Please add listings on the Listings page.</p>
                    <Link href="/dashboard/listings" className="mt-4 inline-block">
                      <Button>Go to Listings</Button>
                    </Link>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
                    <p>Loading your bookings. Please wait or sync your calendar to see more.</p>
                    <div className="text-sm text-gray-400 mt-2">
                      {isLoadingData ? 'Currently syncing...' : 'No events found in your calendars'}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md overflow-hidden">
                    <CalendarComponent
                      events={filteredEvents}
                      listingFilter={selectedListingObject?.name || null}
                      isLoading={isLoadingData}
                      showCheckIns={true}
                      listings={listings}
                      cleaners={cleaners}
                      debugMode={debugMode}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Recent Events</CardTitle>
                    <CardDescription>
                      View the most recently added bookings and events.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <RecentEvents 
                  listingName={selectedListingObject?.name} 
                  limit={10} 
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Job Notifications</CardTitle>
                    <CardDescription>
                      View and manage job completion notifications.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <JobCompletionNotifications />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Mobile-optimized sync modal */}
        <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Sync Calendar</DialogTitle>
            </DialogHeader>
            <SyncModal 
              isOpen={showSyncModal}
              onClose={() => setShowSyncModal(false)}
              onSyncComplete={refreshCalendar}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 