'use client';

import { useState, useEffect, useRef } from 'react';
import { addDays, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, isWithinInterval, startOfWeek, endOfWeek, parse, isValid, differenceInDays } from 'date-fns';
import { Check, Loader2, Calendar as CalendarIcon, AlertTriangle, ChevronRight, ChevronDown, Pencil, ChevronUp } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getCleaners, getListings, Cleaner } from '@/lib/models';
import { 
  getCleanerAssignments, 
  createCleanerAssignment, 
  updateCleanerAssignment,
  deleteCleanerAssignment,
  findCleanerAssignment,
  CleanerEventAssignment 
} from '@/lib/calendar-models';
import { toast } from 'sonner';
import { enUS } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { Switch } from '@/components/ui/switch';

interface CalendarEvent {
  id: string;
  uuid: string;  // Make uuid required, not optional
  title: string;
  start: Date;
  end: Date;
  listing?: string;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  isSameDayCheckout?: boolean;
  assignedCleaner?: string;
  listingId?: string;
  eventId?: string;
  checkoutTime?: string;
  guestName?: string;
  eventType?: string;
  listingName?: string;
  listingHours?: number | string;
  checkoutType?: string;
  cleaner?: Cleaner;
  type?: string;
  recurrence_type?: string;
}

interface CalendarProps {
  events: CalendarEvent[];
  listingFilter?: string | null;
  isLoading?: boolean;
  showCheckIns?: boolean;
  listings: any[];
  cleaners: any[];
  debugMode?: boolean;
}

// Hours per cleaning - default fallback value
const DEFAULT_HOURS_PER_CLEANING = 2;

export function Calendar({ events, listingFilter, isLoading = false, showCheckIns = false, listings = [], cleaners = [], debugMode = false }: CalendarProps) {
  // Add mobile-specific styles
  const mobileStyles = `
    /* Mobile-first calendar styles */
    @media (max-width: 768px) {
      .calendar-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin: 0 -1rem;
        padding: 0 1rem;
      }

      /* Month view specific styles */
      .calendar-month-grid {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 1rem;
      }

      .calendar-month-week {
        flex: 0 0 100%;
        scroll-snap-align: start;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        overflow: hidden;
        margin-right: 1rem;
        min-width: calc(100% - 2rem);
      }

      .calendar-month-week:last-child {
        margin-right: 0;
      }

      .calendar-month-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        border-bottom: 1px solid #e5e7eb;
      }

      .calendar-month-day {
        padding: 0.5rem;
        text-align: center;
        border-right: 1px solid #e5e7eb;
        min-height: 3rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .calendar-month-day.has-events {
        background-color: #f3f4f6;
      }

      .calendar-month-day.today {
        border: 2px solid #3b82f6;
      }

      .calendar-month-events {
        padding: 0.5rem;
      }

      .calendar-event-group {
        margin-bottom: 0.5rem;
      }

      .calendar-event-date {
        font-weight: 500;
        font-size: 0.875rem;
        color: #374151;
        margin-bottom: 0.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .calendar-event-date-actions {
        display: flex;
        gap: 0.5rem;
      }

      .calendar-event-item {
        padding: 0.5rem;
        border-radius: 0.375rem;
        margin-bottom: 0.25rem;
        border-left-width: 3px;
      }

      .calendar-event-item.same-day {
        border-left-color: #8b5cf6;
        background-color: #f5f3ff;
      }

      .calendar-event-item.open {
        border-left-color: #3b82f6;
        background-color: #eff6ff;
      }

      .calendar-event-item.manual {
        border-left-color: #f59e0b;
        background-color: #fef3c7;
      }

      .calendar-event-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
      }

      .calendar-event-type {
        font-size: 0.75rem;
        font-weight: 600;
      }

      .calendar-event-cleaner {
        font-size: 0.75rem;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
      }

      .calendar-event-listing {
        font-size: 0.875rem;
        font-weight: 500;
        color: #1f2937;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .calendar-event-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      /* Existing mobile styles */
      .calendar-header {
        position: sticky;
        top: 0;
        background: white;
        z-index: 10;
        padding: 0.5rem 0;
        border-bottom: 1px solid #e5e7eb;
      }

      .calendar-navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .calendar-view-toggle {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .calendar-day-view {
        display: flex;
        flex-direction: column;
        min-height: calc(100vh - 200px);
      }

      .calendar-week-view {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
      }

      .calendar-day {
        flex: 0 0 100%;
        scroll-snap-align: start;
        padding: 1rem;
        border-right: 1px solid #e5e7eb;
      }

      .calendar-day-header {
        position: sticky;
        top: 0;
        background: white;
        padding: 0.5rem;
        text-align: center;
        font-weight: 500;
        border-bottom: 1px solid #e5e7eb;
      }

      .calendar-event {
        margin: 0.5rem 0;
        padding: 0.75rem;
        border-radius: 0.5rem;
        background: white;
        border: 1px solid #e5e7eb;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .calendar-event-time {
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 0.25rem;
      }

      .calendar-event-title {
        font-weight: 500;
        margin-bottom: 0.25rem;
      }

      .calendar-event-details {
        font-size: 0.875rem;
        color: #4b5563;
      }

      .calendar-event-actions {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      /* Optimize touch targets */
      button {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem 1rem;
      }

      /* Improve form controls for touch */
      select, input {
        min-height: 44px;
        font-size: 16px; /* Prevent zoom on iOS */
      }

      /* Modal improvements */
      .dialog-content {
        margin: 1rem;
        padding: 1rem;
        width: calc(100% - 2rem);
        max-width: none;
      }

      /* Disable animations for better performance */
      * {
        animation-duration: 0s !important;
        transform: none !important;
        transition: none !important;
      }

      /* Disable animations for better performance */
      .no-animation {
        animation: none !important;
        transform: none !important;
        transition: none !important;
      }
    }

    @media (max-width: 768px) and (orientation: landscape) {
      .calendar-container {
        height: calc(100vh - 120px);
        overflow-y: auto;
      }
      .calendar-grid {
        min-width: max-content;
      }
      .calendar-day {
        min-width: 180px;
        height: auto;
      }
    }
  `;

  useEffect(() => {
    // Add mobile styles
    const style = document.createElement('style');
    style.innerHTML = mobileStyles;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [assignedCleaners, setAssignedCleaners] = useState<Record<string, string>>({});
  const [cleanerAssignments, setCleanerAssignments] = useState<CleanerEventAssignment[]>([]);
  const [isLoadingCleaners, setIsLoadingCleaners] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);
  // Add state for bulk assign dialog
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [currentDayForBulkAssign, setCurrentDayForBulkAssign] = useState<Date | null>(null);
  const [listingHours, setListingHours] = useState<Record<string, number>>({});
  const [showCheckoutTimeModal, setShowCheckoutTimeModal] = useState(false);
  const [currentEventForCheckoutTime, setCurrentEventForCheckoutTime] = useState<string | null>(null);
  const [hoursInput, setHoursInput] = useState("");
  const [minutesInput, setMinutesInput] = useState("");
  const [isUpdatingCheckoutTime, setIsUpdatingCheckoutTime] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  // Add state for editing manual events
  const [editManualEvent, setEditManualEvent] = useState<CalendarEvent | null>(null);
  // Add state for edit modal form fields at the top of the Calendar component
  const [editForm, setEditForm] = useState({
    selectedListing: '',
    customListingName: '',
    checkInDateStr: '',
    checkOutDateStr: '',
    checkOutTime: '10:00',
    listingHours: 2, // Always a number
    checkoutType: 'open',
    selectedCleaner: 'none',
    dateError: '',
    // Add recurrence fields
    isRecurring: false,
    recurrenceEndDateStr: '',
    recurrenceType: 'weekly'
  });
  // Add a separate state for the listing hours input as a string for better UX
  const [listingHoursInput, setListingHoursInput] = useState('2.0');
  // Add state for refresh indicator
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Add state for refresh countdown
  const [nextRefreshIn, setNextRefreshIn] = useState<number>(300);
  const REFRESH_INTERVAL = 300; // 5 minutes in seconds
  // Add new state for event details dialog
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<CalendarEvent | null>(null);

  // Add the delete handler function
  const handleDeleteManualEvent = async () => {
    if (!editManualEvent) return;
    
    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return;
    }

    try {
      // First deactivate any cleaner assignments
      const { data: existingAssignments, error: assignFetchError } = await supabase
        .from('cleaner_assignments')
        .select('*')
        .eq('event_uuid', editManualEvent.uuid);
      
      if (assignFetchError) throw assignFetchError;

      if (existingAssignments && existingAssignments.length > 0) {
        const { error: assignUpdateError } = await supabase
          .from('cleaner_assignments')
          .update({ is_active: false })
          .eq('event_uuid', editManualEvent.uuid);
        
        if (assignUpdateError) throw assignUpdateError;
      }

      // Then delete the event
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('uuid', editManualEvent.uuid)
        .eq('event_type', 'manual'); // Extra safety check to only delete manual events

      if (deleteError) throw deleteError;

      toast.success('Manual event deleted successfully');
      setEditManualEvent(null);
      // Refresh calendar data
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      console.error('Error deleting manual event:', error);
      toast.error('Failed to delete manual event');
    }
  };

  // Detect mobile viewport
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Check on initial load
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // Scroll to current day in mobile view
  useEffect(() => {
    if (isMobile && calendarRef.current) {
      const today = new Date();
      
      if (viewMode === 'week') {
        const days = getViewDays();
        const todayIndex = days.findIndex(day => isSameDay(day, today));
        
        if (todayIndex >= 0) {
          const dayWidth = calendarRef.current.scrollWidth / days.length;
          calendarRef.current.scrollLeft = dayWidth * todayIndex;
        }
      } else if (viewMode === 'month') {
        // For month view, find which week contains today
        const firstDayOfMonth = startOfMonth(currentDate);
        const weeks = groupDaysByWeek(getViewDays());
        
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
          const week = weeks[weekIndex];
          const hasTodayInWeek = week.some(day => day && isSameDay(day, today));
          
          if (hasTodayInWeek) {
            const columnWidth = calendarRef.current.scrollWidth / weeks.length;
            calendarRef.current.scrollLeft = columnWidth * weekIndex;
            break;
          }
        }
      }
    }
  }, [isMobile, viewMode, currentDate]);
  
  // Debug: Log events on component render
  useEffect(() => {
    console.log('Calendar Component Received Events:', events);
    console.log('Events count:', events.length);
    if (events.length > 0) {
      console.log('First event:', events[0]);
      console.log('First event start:', events[0].start);
      console.log('First event start type:', typeof events[0].start);
      console.log('Is start a Date object?', events[0].start instanceof Date);
      if (events[0].start instanceof Date) {
        console.log('Date value:', events[0].start.toISOString());
      } else {
        console.log('Not a date instance, trying to convert:', new Date(events[0].start));
      }
    }
  }, [events]);
  
  // Get days for the current view (month or week)
  const getViewDays = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      // Return only the days within the current month
      return eachDayOfInterval({ start: monthStart, end: monthEnd });
    } else {
      // Use Monday as start of week (1) instead of Sunday (0)
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  };
  
  // Group days by week for mobile month view
  const groupDaysByWeek = (days: Date[]) => {
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];
    
    // If we're in month view, we need to add empty days at the beginning
    if (viewMode === 'month' && days.length > 0) {
      const firstDay = days[0];
      const dayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // Convert Sunday (0) to 7
      
      // Add empty days at the beginning to align with weekdays
      for (let i = 1; i < dayOfWeek; i++) {
        currentWeek.push(null as any); // Use null for empty days
      }
    }
    
    // Add days to weeks
    days.forEach(day => {
      const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay(); // Convert Sunday (0) to 7
      
      // Start a new week if it's Monday or if we're at the beginning
      if (dayOfWeek === 1 || currentWeek.length === 0) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek);
        }
        currentWeek = [day];
      } else {
        currentWeek.push(day);
      }
    });
    
    // Add the last week if it has any days
    if (currentWeek.length > 0) {
      // If the last week is not complete, pad it with empty days
      while (currentWeek.length < 7) {
        currentWeek.push(null as any);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  };
  
  const days = getViewDays();
  const weeksByDays = groupDaysByWeek(days);
  
  // Get events for selected day
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  
  // Filter events by listing if filter is provided
  const filteredEvents = listingFilter 
    ? events.filter(event => event.listing === listingFilter)
    : events;
  
  // Get events for selected day
  const selectedDayEvents = selectedDay 
    ? filteredEvents.filter(event => {
        try {
          const startDate = event.start instanceof Date ? event.start : new Date(event.start);
          const endDate = event.end instanceof Date ? event.end : new Date(event.end);
          return isSameDay(selectedDay, startDate) || isSameDay(selectedDay, endDate);
        } catch (e) {
          console.error('Invalid date comparison in selectedDayEvents:', e);
          return false;
        }
      })
    : [];

  // Change the week days header to start with Monday
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Load cleaners and assignments on component mount and when events change
  useEffect(() => {
    console.log('Loading cleaners and assignments due to events change or component mount');
    loadCleanersAndAssignments();
  }, [events]); // Reload assignments when events change

  // Ensure we refresh assignments data on a timer to keep UI in sync
  useEffect(() => {
    // Initial load
    loadCleanersAndAssignments();
    
    // Set up an interval to periodically refresh assignments data
    const refreshInterval = setInterval(() => {
      console.log('Periodic refresh of cleaner assignments');
      loadCleanersAndAssignments();
    }, 300000); // Refresh every 5 minutes
    
    // Clean up interval on component unmount
    return () => clearInterval(refreshInterval);
  }, []);

  // Use effect to refresh cleaner data when dialog opens
  useEffect(() => {
    if (assignDialogOpen && currentEventId) {
      console.log('Refreshing cleaner data for assignment dialog');
      loadCleanersAndAssignments();
    }
  }, [assignDialogOpen, currentEventId]);

  // Function to load cleaners and assignments from database
  const loadCleanersAndAssignments = async () => {
    if (debugMode) {
      setIsRefreshing(true);
      setNextRefreshIn(REFRESH_INTERVAL);
    }
    
    try {
      // Load cleaners
      const cleanersData: Cleaner[] = await getCleaners();
      
      // Load cleaner assignments
      const activeAssignments: CleanerEventAssignment[] = await getCleanerAssignments();
      
      // Create assignments map for the UI
      const assignmentsMap: Record<string, string> = {};
      
      // Process each active assignment
      for (const assignment of activeAssignments) {
        if (!assignment.is_active) continue;
        
        const cleaner = cleanersData.find(c => c.id === assignment.cleaner_uuid);
        if (cleaner) {
          // Find the event using UUID only
          const event = filteredEvents.find(e => e.uuid === assignment.event_uuid);
          
          if (event) {
            // Map using the event's UUID
            assignmentsMap[event.uuid] = cleaner.name;
            
            if (debugMode) {
              console.log(`Mapped assignment: Event ${event.uuid} -> Cleaner ${cleaner.name}`);
            }
          } else if (debugMode) {
            console.log(`Assignment ${assignment.uuid} references event ${assignment.event_uuid} which is not in current view`);
          }
        } else if (debugMode) {
          console.log(`Assignment ${assignment.uuid} references unknown cleaner ${assignment.cleaner_uuid}`);
        }
      }
      
      // Store assignments in state
      setCleanerAssignments(activeAssignments);
      
      // Debug logging
      if (debugMode) {
        const currentAssignments = Object.keys(assignedCleaners);
        const newAssignments = Object.keys(assignmentsMap);
        const added = newAssignments.filter(id => !currentAssignments.includes(id));
        const removed = currentAssignments.filter(id => !newAssignments.includes(id));
        
        console.log('\n=== Assignment Changes ===');
        if (added.length > 0) {
          console.log(`Added ${added.length} assignments:`, added);
        }
        if (removed.length > 0) {
          console.log(`Removed ${removed.length} assignments:`, removed);
        }
        
        console.log('\nAssignment Details:');
        console.log('Total active assignments:', activeAssignments.length);
        console.log('Assignments in current view:', Object.keys(assignmentsMap).length);
      }
      
      // Update the UI state with the new assignments map
      setAssignedCleaners(assignmentsMap);
      
    } catch (error) {
      console.error('Error loading cleaners and assignments:', error);
      toast.error("Failed to load cleaner data. Please refresh the page.");
    } finally {
      if (debugMode) {
        setIsRefreshing(false);
      }
    }
  };

  // Group check-in and check-out events by listing (but don't combine them as guest changes)
  const groupEventsByListing = (checkIns: CalendarEvent[], checkOuts: CalendarEvent[]) => {
    return {
      checkOuts,
      checkIns
    };
  };

  // Generate a unique event ID for cleaner assignment (checkout date + listing name)
  const generateEventKey = (event: CalendarEvent) => {
    const dateStr = format(event.end, 'yyyy-MM-dd');
    const listingName = event.listing || 'unnamed';
    return `${dateStr}-${listingName}`;
  };

  // Get week boundaries (Monday to Sunday) for any date
  const getWeekBoundaries = (date: Date) => {
    // Calculate the date of Monday (start of week) for this date
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    
    // Calculate the date of Sunday (end of week) for this date
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    
    return { start: weekStart, end: weekEnd };
  };

  // Check if a date is within a given week
  const isInWeek = (date: Date, weekDate: Date) => {
    try {
      // Get the week boundaries for the reference week date
      const week = getWeekBoundaries(weekDate);
      
      // Check if the date is within the week boundaries
      return isWithinInterval(date, { 
        start: week.start, 
        end: week.end 
      });
    } catch (e) {
      console.error('Error checking if date is in week:', e);
      return false;
    }
  };

  // Check if a date is in the current week
  const isCurrentWeek = (date: Date) => {
    try {
      return isInWeek(date, new Date());
    } catch (e) {
      console.error('Error checking if date is in current week:', e);
      return false;
    }
  };

  // Get a formatted string representation of the week range for a date
  const getWeekRangeForDate = (date: Date) => {
    const { start, end } = getWeekBoundaries(date);
    return `${format(start, 'MMM d', { locale: enUS })} - ${format(end, 'MMM d', { locale: enUS })}`;
  };

  // Modify getDayStatus to include sorted events by type and base name
  const getDayStatus = (day: Date) => {
    // Reduce debug logging that could cause performance issues
    const dayFormatted = format(day, 'yyyy-MM-dd');
    
    // Check if this day is in the current week
    const isInViewedWeek = viewMode === 'month' ? isInWeek(day, currentDate) : false;
    
    // Ensure we're working with Date objects for comparison
    const checkIns = filteredEvents.filter(event => {
      try {
        return event.isCheckIn && isSameDay(day, event.start);
      } catch (e) {
        console.error(`Invalid date comparison for check-in (${dayFormatted}):`, e);
        return false;
      }
    });
    
    const checkOuts = filteredEvents.filter(event => {
      try {
        // For checkout events, use isCheckOut flag to ensure uniqueness
        return event.isCheckOut && isSameDay(day, event.end);
      } catch (e) {
        console.error(`Invalid date comparison for check-out (${dayFormatted}):`, e);
        return false;
      }
    });
    
    if (checkIns.length === 0 && checkOuts.length === 0 && !isInViewedWeek) return null;
    
    // Group by id to prevent duplicates
    const uniqueCheckIns = checkIns.reduce((acc, event) => {
      acc[event.id] = event;
      return acc;
    }, {} as Record<string, CalendarEvent>);
    
    const uniqueCheckOuts = checkOuts.reduce((acc, event) => {
      acc[event.id] = event;
      return acc;
    }, {} as Record<string, CalendarEvent>);
    
    // Get arrays of check-ins and check-outs
    const checkInsArray = Object.values(uniqueCheckIns);
    const checkOutsArray = Object.values(uniqueCheckOuts);
    
    // Separate same-day checkouts from regular checkouts
    const sameDayCheckouts = checkOutsArray.filter(event => isSameDayCheckout(day, event));
    const regularCheckouts = checkOutsArray.filter(event => !isSameDayCheckout(day, event));
    
    // Sort each category by base name
    const sortedSameDayCheckouts = sortEventsByListingBase(sameDayCheckouts);
    const sortedRegularCheckouts = sortEventsByListingBase(regularCheckouts);
    const sortedCheckIns = sortEventsByListingBase(checkInsArray);
    
    // Combined sorted checkouts (same-day first, then regular)
    const sortedCheckOuts = [...sortedSameDayCheckouts, ...sortedRegularCheckouts];
    
    // Create a combined array of all events sorted by type and base name
    const allSortedEvents = sortEventsByTypeAndBase([...checkInsArray, ...checkOutsArray], day);
    
    return {
      hasEvents: checkIns.length > 0 || checkOuts.length > 0,
      checkIns: sortedCheckIns,
      checkOuts: sortedCheckOuts,
      sameDayCheckouts: sortedSameDayCheckouts,
      regularCheckouts: sortedRegularCheckouts,
      eventCount: Object.keys(uniqueCheckIns).length + Object.keys(uniqueCheckOuts).length,
      listings: [...new Set([...checkIns, ...checkOuts].map(event => event.listing).filter(Boolean))],
      groupedEvents: groupEventsByListing(sortedCheckIns, sortedCheckOuts),
      isInViewedWeek, // Add this property to indicate if the day is in the viewed week
      allSortedEvents // Add all events sorted by type
    };
  };

  // Update to set a specific dialog ID
  const openAssignDialog = (eventId: string) => {
    setCurrentEventId(eventId);
    setAssignDialogOpen(true);
  };

  // Function to open bulk assign dialog for a specific day
  const openBulkAssignDialog = (day: Date) => {
    setCurrentDayForBulkAssign(day);
    setBulkAssignDialogOpen(true);
  };

  // Get hours for a specific listing
  const getHoursForListing = (listingName: string | undefined): number => {
    if (!listingName) return DEFAULT_HOURS_PER_CLEANING;
    return listingHours[listingName] || DEFAULT_HOURS_PER_CLEANING;
  };

  // Update the assignCleaner function
  const assignCleaner = async (eventUuid: string, cleanerName: string) => {
    // Find the cleaner and event details
    const cleaner = cleaners.find(c => c.name === cleanerName);
    const event = filteredEvents.find(e => e.uuid === eventUuid);
    
    if (!cleaner || !event) {
      console.error('Could not find cleaner or event:', { cleanerName, eventUuid });
      toast.error("Error: Couldn't find cleaner or event details.");
      return;
    }
    
    // Verify this is a checkout event
    if (!event.isCheckOut) {
      console.warn('Attempted to assign cleaner to a non-checkout event:', eventUuid);
      toast.error("Error: Can only assign cleaners to check-out events.");
      return;
    }
    
    console.log(`Assigning cleaner ${cleanerName} (${cleaner.id}) to event ${eventUuid}`);
    
    try {
      // First, deactivate any existing assignments for this event
      const { data: existingAssignments } = await supabase
        .from('cleaner_assignments')
        .select('*')
        .eq('event_uuid', eventUuid)
        .eq('is_active', true);
      
      if (existingAssignments && existingAssignments.length > 0) {
        console.log(`Deactivating ${existingAssignments.length} existing assignments`);
        
        // Deactivate all existing assignments in a single operation
        const { error: deactivateError } = await supabase
          .from('cleaner_assignments')
          .update({ is_active: false })
          .in('uuid', existingAssignments.map(a => a.uuid));
        
        if (deactivateError) throw deactivateError;
        
        // Update local state to reflect deactivated assignments
        setCleanerAssignments(prev => 
          prev.map(a => 
            existingAssignments.some(ea => ea.uuid === a.uuid)
              ? { ...a, is_active: false }
              : a
          )
        );
      }
      
      // Create new assignment
      console.log(`Creating new assignment for event ${eventUuid} with cleaner ${cleaner.id}`);
      
      // Get the hours for this listing
      const hours = getHoursForListing(event.listing);
      
      // Create the new assignment
      const { data: newAssignment, error: createError } = await supabase
        .from('cleaner_assignments')
        .insert({
          cleaner_uuid: cleaner.id,
          event_uuid: eventUuid,
          hours: hours,
          is_active: true
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Update local state
      if (newAssignment) {
        setCleanerAssignments(prev => [...prev, newAssignment]);
        
        // Update the assignedCleaners map for the UI
        setAssignedCleaners(prev => ({
          ...prev,
          [eventUuid]: cleanerName
        }));
        
        toast.success(`Assigned to ${cleanerName}`);
      }
      
      // Close the dialog
      setAssignDialogOpen(false);
      
      // Refresh assignments to ensure everything is in sync
      await loadCleanersAndAssignments();
      
    } catch (error) {
      console.error('Error assigning cleaner:', error);
      toast.error("Failed to assign cleaner. Please try again.");
    }
  };

  // Update the bulkAssignCleaner function
  const bulkAssignCleaner = async (day: Date | null, cleanerName: string) => {
    if (!day) {
      toast.error('No day selected for bulk assignment');
      return;
    }
    
    const cleaner = cleaners.find(c => c.name === cleanerName);
    if (!cleaner) {
      console.error('Could not find cleaner:', cleanerName);
      toast.error("Error: Couldn't find cleaner details.");
      return;
    }
    
    const dayStatus = getDayStatus(day);
    if (!dayStatus) {
      console.error('No events found for the specified day');
      toast.error("Error: No events found for the specified day.");
      return;
    }
    
    // Get all checkout events for the day (both same-day and regular)
    const checkoutEvents = [...dayStatus.sameDayCheckouts, ...dayStatus.regularCheckouts];
    
    if (checkoutEvents.length === 0) {
      toast.info("No checkout events found for this day.");
      setBulkAssignDialogOpen(false);
      return;
    }
    
    try {
      toast.loading(`Assigning ${cleanerName} to ${checkoutEvents.length} events...`, { id: 'bulk-assign' });
      
      // Keep track of how many assignments were created/updated
      let created = 0;
      let updated = 0;
      
      // Process each checkout event
      for (const event of checkoutEvents) {
        if (!event.uuid) {
          console.warn('Skipping event without UUID:', {
            id: event.id,
            listing: event.listing,
            start: event.start,
            end: event.end
          });
          continue;
        }
        
        const existingAssignment = cleanerAssignments.find(
          a => a.event_uuid === event.uuid && a.is_active
        );
        
        if (existingAssignment) {
          // Update existing assignment
          await updateCleanerAssignment(existingAssignment.uuid, {
            cleaner_uuid: cleaner.id,
            is_active: true
          });
          updated++;
        } else {
          // Create new assignment
          const assignmentData = {
            cleaner_uuid: cleaner.id,
            event_uuid: event.uuid,
            hours: getHoursForListing(event.listing),
            is_active: true
          };
          
          await createCleanerAssignment(assignmentData);
          created++;
        }
        
        // Update the assignedCleaners map for the UI
        setAssignedCleaners(prev => ({
          ...prev,
          [event.uuid]: cleanerName
        }));
      }
      
      // Refresh assignments data
      await loadCleanersAndAssignments();
      
      // Show success message
      toast.success(`Assigned ${cleanerName} to ${created + updated} events (${created} new, ${updated} updated)`, { id: 'bulk-assign' });
      
      // Close the dialog
      setBulkAssignDialogOpen(false);
    } catch (error) {
      console.error('Error in bulk assign:', error);
      toast.error("Failed to assign cleaner to some events.", { id: 'bulk-assign' });
    }
  };

  // Update the unassignCleaner function
  const unassignCleaner = async (eventUuid: string) => {
    // Find the event
    const event = filteredEvents.find(e => e.uuid === eventUuid);
    
    if (!event) {
      console.error('Could not find event:', eventUuid);
      toast.error("Error: Couldn't find event details.");
      return;
    }
    
    try {
      // Find all active assignments for this event
      const { data: existingAssignments } = await supabase
        .from('cleaner_assignments')
        .select('*')
        .eq('event_uuid', eventUuid)
        .eq('is_active', true);
      
      if (!existingAssignments || existingAssignments.length === 0) {
        console.log(`No active assignments found for event ${eventUuid}`);
        
        // Still update the UI state to ensure consistency
        setAssignedCleaners(prev => {
          const updated = { ...prev };
          delete updated[eventUuid];
          return updated;
        });
        
        toast.info("No active assignments found for this event.");
        setAssignDialogOpen(false);
        return;
      }
      
      console.log(`Deactivating ${existingAssignments.length} assignments for event ${eventUuid}`);
      
      // Deactivate all assignments in a single operation
      const { error: deactivateError } = await supabase
        .from('cleaner_assignments')
        .update({ is_active: false })
        .in('uuid', existingAssignments.map(a => a.uuid));
      
      if (deactivateError) throw deactivateError;
      
      // Update local state
      setCleanerAssignments(prev => 
        prev.map(a => 
          existingAssignments.some(ea => ea.uuid === a.uuid)
            ? { ...a, is_active: false }
            : a
        )
      );
      
      // Remove from the assignedCleaners map for the UI
      setAssignedCleaners(prev => {
        const updated = { ...prev };
        delete updated[eventUuid];
        return updated;
      });
      
      console.log(`Successfully unassigned cleaner(s) from event ${eventUuid}`);
      toast.success("Cleaner unassigned successfully.");
      
      // Close the dialog
      setAssignDialogOpen(false);
      
      // Refresh assignments to ensure everything is in sync
      await loadCleanersAndAssignments();
      
    } catch (error) {
      console.error('Error unassigning cleaner:', error);
      toast.error("Failed to unassign cleaner. Please try again.");
    }
  };

  // Add a function to format the current week range for display
  const getCurrentWeekRange = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    return `${format(weekStart, 'MMM d', { locale: enUS })} - ${format(weekEnd, 'MMM d', { locale: enUS })}`;
  };

  // Update the renderCleanerButton function to not display hours
  const renderCleanerButton = (cleaner: Cleaner, eventId: string) => {
    const isAssigned = assignedCleaners[eventId] === cleaner.name;
    
    return (
      <Button 
        key={cleaner.id} 
        variant={isAssigned ? "default" : "outline"}
        className="justify-between w-full" 
        onClick={() => assignCleaner(eventId, cleaner.name)}
      >
        <span className="font-medium">{cleaner.name}</span>
        <span>
          {isAssigned && <Check className="h-4 w-4" />}
        </span>
      </Button>
    );
  };

  // Helper function to safely compare dates for same day
  const safeSameDay = (date1: any, date2: any): boolean => {
    try {
      // Convert to Date objects if not already
      const d1 = date1 instanceof Date ? date1 : new Date(date1);
      const d2 = date2 instanceof Date ? date2 : new Date(date2);
      
      // Check if both dates are valid
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
        console.warn('Invalid date in comparison', { date1, date2 });
        return false;
      }
      
      // Use date-fns isSameDay for more reliable comparison
      return isSameDay(d1, d2);
    } catch (e) {
      console.error('Error comparing dates', e, { date1, date2 });
      return false;
    }
  };

  // Helper function to extract the base name from a listing name (part before the period)
  const getListingBaseName = (listingName: string | undefined): string => {
    if (!listingName) return 'Unknown';
    
    // Split by the period and take the first part
    const parts = listingName.split('.');
    return parts.length > 1 ? parts[0] : listingName;
  };
  
  // Helper function to sort events by listing base name
  const sortEventsByListingBase = (events: CalendarEvent[]): CalendarEvent[] => {
    return [...events].sort((a, b) => {
      const baseNameA = getListingBaseName(a.listing);
      const baseNameB = getListingBaseName(b.listing);
      
      // Sort by base name first
      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameB);
      }
      
      // If base names are the same, sort by full listing name
      return (a.listing || '').localeCompare(b.listing || '');
    });
  };
  
  // Helper function to sort events by type first (same day checkouts first, then open checkouts, then check-ins)
  // and then by listing base name
  const sortEventsByTypeAndBase = (events: CalendarEvent[], day: Date): CalendarEvent[] => {
    return [...events].sort((a, b) => {
      // First sort by event type
      const aIsSameDayCheckout = a.isCheckOut && isSameDayCheckout(day, a);
      const bIsSameDayCheckout = b.isCheckOut && isSameDayCheckout(day, b);
      const aIsCheckOut = a.isCheckOut;
      const bIsCheckOut = b.isCheckOut;
      
      // Same day checkouts first
      if (aIsSameDayCheckout && !bIsSameDayCheckout) return -1;
      if (!aIsSameDayCheckout && bIsSameDayCheckout) return 1;
      
      // Then regular checkouts
      if (aIsCheckOut && !bIsCheckOut) return -1;
      if (!aIsCheckOut && bIsCheckOut) return 1;
      
      // If both are same type, sort by base name
      const baseNameA = getListingBaseName(a.listing);
      const baseNameB = getListingBaseName(b.listing);
      
      if (baseNameA !== baseNameB) {
        return baseNameA.localeCompare(baseNameB);
      }
      
      // If base names are the same, sort by full listing name
      return (a.listing || '').localeCompare(b.listing || '');
    });
  };

  // Add function to check if check-in and check-out are on same day
  const isSameDayCheckout = (day: Date, checkOut: CalendarEvent): boolean => {
    try {
      // First check if the event already has the isSameDayCheckout property set by the API
      if (checkOut.isSameDayCheckout !== undefined) {
        return checkOut.isSameDayCheckout;
      }
      
      // Fallback to the original logic of checking if there is a check-in event on the same day
      // Find if there is a check-in on this same day and for the same listing
      const checkInEvents = filteredEvents.filter(event => 
        event.isCheckIn && 
        safeSameDay(day, event.start) && 
        event.listing === checkOut.listing
      );
      
      return checkInEvents.length > 0;
    } catch (e) {
      console.error('Error checking for same day checkout:', e);
      return false;
    }
  };

  // Create a shared dialog component that's rendered once for the selected event
  const renderCleanerAssignmentDialog = () => {
    // Only render if there's a current event ID and the dialog is open
    if (!currentEventId || !assignDialogOpen) return null;
    
    // Find the current event
    const currentEvent = filteredEvents.find(e => e.id === currentEventId);
    if (!currentEvent) return null;
    
    return (
      <Dialog 
        open={assignDialogOpen} 
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) setCurrentEventId(null);
        }}
      >
        <DialogContent className="min-w-[350px] no-animation">
          <style>{mobileStyles}</style>
          <DialogHeader>
            <DialogTitle>Assign Cleaner</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              Select a cleaner to assign to this checkout.
            </p>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {cleaners.map(cleaner => renderCleanerButton(cleaner, currentEventId))}
            
            {/* Add unassign button if a cleaner is already assigned */}
            {assignedCleaners[currentEventId] && (
              <Button 
                variant="outline" 
                className="mt-2 border-dashed border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => unassignCleaner(currentEventId)}
              >
                Unassign {assignedCleaners[currentEventId]}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Add bulk unassign function
  const bulkUnassignCleaners = async (day: Date) => {
    const dayStatus = getDayStatus(day);
    const checkoutEvents = dayStatus ? [...dayStatus.sameDayCheckouts, ...dayStatus.regularCheckouts] : [];
    
    if (!checkoutEvents.length) {
      toast.error('No checkout events found for this day');
      return;
    }
    
    try {
      toast.loading(`Unassigning cleaners from ${checkoutEvents.length} events...`, { id: 'bulk-unassign' });
      
      let unassigned = 0;
      
      // Get all active assignments for these events in one query
      const { data: activeAssignments, error: fetchError } = await supabase
        .from('cleaner_assignments')
        .select('*')
        .in('event_uuid', checkoutEvents.map(event => event.uuid))
        .eq('is_active', true);
        
      if (fetchError) throw fetchError;
      
      if (activeAssignments && activeAssignments.length > 0) {
        // Delete the assignments instead of marking them inactive
        const { error: deleteError } = await supabase
          .from('cleaner_assignments')
          .delete()
          .in('uuid', activeAssignments.map(a => a.uuid));
          
        if (deleteError) throw deleteError;
        
        unassigned = activeAssignments.length;
        
        // Update the local state by removing the assignments
        setCleanerAssignments(prev => 
          prev.filter(a => !activeAssignments.some(aa => aa.uuid === a.uuid))
        );
        
        // Update the assignedCleaners map for the UI
        setAssignedCleaners(prev => {
          const newMap = { ...prev };
          activeAssignments.forEach(assignment => {
            const event = checkoutEvents.find(e => e.uuid === assignment.event_uuid);
            if (event) {
              delete newMap[event.uuid];
            }
          });
          return newMap;
        });
      }
      
      // Refresh assignments data to ensure UI is in sync with database
      await loadCleanersAndAssignments();
      
      // Show success message
      toast.success(`Unassigned cleaners from ${unassigned} events`, { id: 'bulk-unassign' });
      
      // Close the dialog
      setBulkAssignDialogOpen(false);
    } catch (error) {
      console.error('Error unassigning cleaners:', error);
      toast.error('Failed to unassign cleaners: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'bulk-unassign' });
    }
  };

  // Update the bulk assign dialog render function
  const renderBulkAssignDialog = () => {
    if (!currentDayForBulkAssign) return null;

    return (
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent className="min-w-[350px] no-animation">
          <style>{mobileStyles}</style>
          <DialogHeader>
            <DialogTitle>Assign Cleaner to All Checkouts</DialogTitle>
            <p className="text-sm text-gray-500 mt-1">
              {format(currentDayForBulkAssign, 'EEEE, MMMM d, yyyy')}
            </p>
          </DialogHeader>
          <div className="space-y-2">
            {cleaners.map((cleaner) => (
              <Button
                key={cleaner.id}
                variant="outline"
                className="justify-between w-full"
                onClick={() => {
                  if (currentDayForBulkAssign) {
                    bulkAssignCleaner(currentDayForBulkAssign, cleaner.name);
                  }
                }}
              >
                <span className="font-medium">{cleaner.name}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Update the openCheckoutTimeModal function to split hours and minutes
  const openCheckoutTimeModal = (eventId: string, currentTime?: string) => {
    console.log('Opening checkout time modal for event:', { eventId, currentTime });
    
    // Make sure we're using the UUID if available
    let targetEventId = eventId;
    
    // Try to find the event by eventId to get its UUID
    const event = filteredEvents.find(e => e.eventId === eventId || e.id === eventId);
    if (event) {
      // Prefer using the UUID if available
      if (event.uuid) {
        targetEventId = event.uuid;
        console.log(`Found matching event. Using uuid instead: ${targetEventId}`);
      } else if (event.eventId) {
        targetEventId = event.eventId;
        console.log(`Found matching event. Using eventId: ${targetEventId}`);
      }
    } else {
      console.log(`No matching event found for ID: ${eventId}`);
    }
    
    setCurrentEventForCheckoutTime(targetEventId);
    
    // Parse the current time if it exists
    if (currentTime) {
      const timeParts = currentTime.split(':');
      if (timeParts.length >= 2) {
        setHoursInput(timeParts[0]);
        setMinutesInput(timeParts[1]);
      } else {
        setHoursInput('');
        setMinutesInput('');
      }
    } else {
      setHoursInput('');
      setMinutesInput('');
    }
    
    setShowCheckoutTimeModal(true);
  };

  // Add functions to handle incrementing and decrementing time values
  const incrementHours = () => {
    const currentHours = parseInt(hoursInput) || 0;
    const newHours = (currentHours + 1) % 24;
    setHoursInput(newHours.toString().padStart(2, '0'));
  };

  const decrementHours = () => {
    const currentHours = parseInt(hoursInput) || 0;
    const newHours = (currentHours - 1 + 24) % 24;
    setHoursInput(newHours.toString().padStart(2, '0'));
  };

  const incrementMinutes = () => {
    const currentMinutes = parseInt(minutesInput) || 0;
    const newMinutes = (currentMinutes + 1) % 60;
    setMinutesInput(newMinutes.toString().padStart(2, '0'));
  };

  const decrementMinutes = () => {
    const currentMinutes = parseInt(minutesInput) || 0;
    const newMinutes = (currentMinutes - 1 + 60) % 60;
    setMinutesInput(newMinutes.toString().padStart(2, '0'));
  };

  // Update the updateCheckoutTime function to use hours and minutes
  const updateCheckoutTime = async () => {
    if (!currentEventForCheckoutTime) {
      console.error('No event ID provided for checkout time update');
      toast.error('Missing event ID for checkout time update');
      return;
    }
    
    console.log('Updating checkout time for event:', currentEventForCheckoutTime);
    
    // Parse and validate hours
    let hours = parseInt(hoursInput);
    if (isNaN(hours)) hours = 0;
    hours = Math.max(0, Math.min(23, hours));
    
    // Parse and validate minutes
    let minutes = parseInt(minutesInput);
    if (isNaN(minutes)) minutes = 0;
    minutes = Math.max(0, Math.min(59, minutes));
    
    // Format as HH:MM
    const timeToSave = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    console.log(`Formatted time to save: ${timeToSave}`);
    
    setIsUpdatingCheckoutTime(true);
    
    try {
      // Use the updated API endpoint to update the checkout time in the new events table
      console.log('Sending API request to update checkout time');
      const response = await fetch('/api/calendar/update-checkout-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventId: currentEventForCheckoutTime,
          checkoutTime: timeToSave
        })
      });
      
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to update checkout time: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('API response data:', result);
      
      if (result.success) {
        toast.success('Checkout time updated successfully');
        
        // This updates the client-side cache of events
        // Support both eventId and uuid for compatibility
        let updatedCount = 0;
        for (let i = 0; i < events.length; i++) {
          if (events[i].eventId === currentEventForCheckoutTime || 
              events[i].uuid === currentEventForCheckoutTime ||
              events[i].id === currentEventForCheckoutTime) {
            events[i].checkoutTime = timeToSave;
            updatedCount++;
          }
        }
        console.log(`Updated ${updatedCount} events in client-side cache`);
        
        // Force a refresh by reloading the assignments
        await loadCleanersAndAssignments();
        
        // Close the modal
        setShowCheckoutTimeModal(false);
        setCurrentEventForCheckoutTime(null);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error updating checkout time:', error);
      toast.error('Failed to update checkout time: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdatingCheckoutTime(false);
    }
  };
  
  // Format checkout time to display in 12-hour format (e.g., "10am" or "10:05am")
  const formatCheckoutTime = (timeString?: string): string => {
    if (!timeString) return '';
    
    try {
      // Parse the time string (assumes format like "HH:MM" or "HH:MM:SS")
      const [hours, minutes] = timeString.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) return '';
      
      // Convert to 12-hour format
      const period = hours >= 12 ? 'pm' : 'am';
      const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12am
      
      // Only show minutes if they're not zero
      return minutes === 0 ? 
        `${displayHours}${period}` : 
        `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
    } catch (error) {
      console.error('Error formatting checkout time:', error);
      return '';
    }
  };
  
  // Add a function to open the edit dialog for manual events
  const openEditManualEventDialog = (event: CalendarEvent) => {
    setEditManualEvent(event);
    const hours = event.listingHours ? parseFloat(event.listingHours as any) : 2;
    setEditForm({
      selectedListing: event.listingName || event.listing || '',
      customListingName: '',
      checkInDateStr: event.start ? format(event.start, 'dd/MM/yyyy') : '',
      checkOutDateStr: event.end ? format(event.end, 'dd/MM/yyyy') : '',
      checkOutTime: event.checkoutTime || '10:00',
      listingHours: hours,
      checkoutType: event.checkoutType || 'open',
      selectedCleaner: event.cleaner?.id || 'none',
      dateError: '',
      // Add recurrence fields
      isRecurring: false,
      recurrenceEndDateStr: '',
      recurrenceType: 'weekly'
    });
    setListingHoursInput(hours.toFixed(1));
  };

  // Update the renderEditManualEventDialog to use editForm state
  const renderEditManualEventDialog = () => {
    if (!editManualEvent) return null;
    return (
      <Dialog open={!!editManualEvent} onOpenChange={() => setEditManualEvent(null)}>
        <DialogContent className="min-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Manual Event</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Listing</Label>
              <Select value={editForm.selectedListing} onValueChange={val => setEditForm(f => ({ ...f, selectedListing: val }))}>
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
              {editForm.selectedListing === 'custom' && (
                <Input
                  placeholder="Enter custom listing name"
                  value={editForm.customListingName}
                  onChange={e => setEditForm(f => ({ ...f, customListingName: e.target.value }))}
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Check-in Date (Optional)</Label>
              <div className="flex flex-col gap-1">
                <Input
                  placeholder="dd/mm/yyyy"
                  value={editForm.checkInDateStr}
                  onChange={e => setEditForm(f => ({ ...f, checkInDateStr: e.target.value, dateError: '' }))}
                />
                <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Check-out Date</Label>
              <div className="flex flex-col gap-1">
                <Input
                  placeholder="dd/mm/yyyy"
                  value={editForm.checkOutDateStr}
                  onChange={e => setEditForm(f => ({ ...f, checkOutDateStr: e.target.value, dateError: '' }))}
                />
                <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
              </div>
              {editForm.dateError && (
                <span className="text-sm text-red-500">{editForm.dateError}</span>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Check-out Time</Label>
              <Input
                type="time"
                value={editForm.checkOutTime}
                onChange={e => setEditForm(f => ({ ...f, checkOutTime: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Listing Hours</Label>
              <Input
                type="number"
                value={listingHoursInput}
                onChange={e => {
                  setListingHoursInput(e.target.value);
                  const floatVal = parseFloat(e.target.value);
                  if (!isNaN(floatVal)) {
                    setEditForm(f => ({ ...f, listingHours: floatVal }));
                  }
                }}
                min="0"
                step="0.5"
              />
            </div>
            <div className="grid gap-2">
              <Label>Checkout Type</Label>
              <Select value={editForm.checkoutType} onValueChange={(value: 'same_day' | 'open') => setEditForm(f => ({ ...f, checkoutType: value }))}>
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
              <Select value={editForm.selectedCleaner} onValueChange={val => setEditForm(f => ({ ...f, selectedCleaner: val }))}>
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
            
            {/* Add recurrence section */}
            <div className="grid gap-2">
              <Label>Recurrence</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.isRecurring}
                  onCheckedChange={(checked) => setEditForm(f => ({ ...f, isRecurring: checked }))}
                />
                <span className="text-sm">Repeat Weekly</span>
              </div>
              
              {editForm.isRecurring && (
                <div className="grid gap-2 mt-2">
                  <Label>End Date</Label>
                  <div className="flex flex-col gap-1">
                    <Input
                      placeholder="dd/mm/yyyy"
                      value={editForm.recurrenceEndDateStr}
                      onChange={e => setEditForm(f => ({ ...f, recurrenceEndDateStr: e.target.value }))}
                    />
                    <span className="text-xs text-muted-foreground">Format: dd/mm/yyyy</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="destructive" onClick={handleDeleteManualEvent}>
              Delete Event
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditManualEvent(null)}>
                Cancel
              </Button>
              <Button onClick={handleManualEventEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  
  const handleManualEventEdit = async () => {
    if (!editManualEvent) return;
    
    // Validation (same as create)
    const parseDate = (dateStr: string) => {
      if (!dateStr) return null;
      const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
      return isValid(parsed) ? parsed : null;
    };
    
    // Ensure listingHours is up to date with the input
    const floatVal = parseFloat(listingHoursInput);
    const listingHours = isNaN(floatVal) ? 0 : floatVal;
    setEditForm(f => ({ ...f, listingHours }));
    
    const checkOutDate = parseDate(editForm.checkOutDateStr);
    if (!editForm.checkOutDateStr || !checkOutDate) {
      setEditForm(f => ({ ...f, dateError: 'Check-out date is required in dd/mm/yyyy format' }));
      return;
    }
    
    const checkInDate = editForm.checkInDateStr ? parseDate(editForm.checkInDateStr) : null;
    if (editForm.checkInDateStr && !checkInDate) {
      setEditForm(f => ({ ...f, dateError: 'Check-in date must be in dd/mm/yyyy format' }));
      return;
    }
    
    // Validate recurrence end date if recurring
    let recurrenceEndDate = null;
    if (editForm.isRecurring) {
      recurrenceEndDate = parseDate(editForm.recurrenceEndDateStr);
      if (!recurrenceEndDate) {
        setEditForm(f => ({ ...f, dateError: 'Recurrence end date is required in dd/mm/yyyy format' }));
        return;
      }
      // Ensure end date is after the checkout date
      if (recurrenceEndDate <= checkOutDate) {
        setEditForm(f => ({ ...f, dateError: 'Recurrence end date must be after the checkout date' }));
        return;
      }
    }
    
    const finalListingName = editForm.selectedListing === 'custom' ? editForm.customListingName : editForm.selectedListing;
    if (!finalListingName) {
      toast.error('Listing name is required');
      return;
    }
    
    try {
      // Generate a recurring series ID if this is a recurring event
      const recurringSeriesId = editForm.isRecurring ? crypto.randomUUID() : null;
      
      // Calculate all event dates if recurring
      const eventDates = [];
      if (editForm.isRecurring && recurrenceEndDate) {
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
      
      // Create/update events
      for (const dates of eventDates) {
        const eventData = {
          listing_name: finalListingName,
          listing_hours: listingHours,
          checkin_date: dates.checkIn.toISOString(),
          checkout_date: dates.checkOut.toISOString(),
          checkout_type: editForm.checkoutType,
          checkout_time: editForm.checkOutTime,
          event_type: 'manual',
          recurring_series_id: recurringSeriesId,
          recurrence_type: editForm.isRecurring ? 'weekly' : null,
          recurrence_end_date: recurrenceEndDate?.toISOString() || null
        };
        
        if (eventDates.indexOf(dates) === 0) {
          // Update the original event
          const { error: eventError } = await supabase
            .from('events')
            .update(eventData)
            .eq('uuid', editManualEvent.uuid)
            .select();
          if (eventError) throw eventError;
        } else {
          // Create new events for additional occurrences
          const { error: eventError } = await supabase
            .from('events')
            .insert({
              ...eventData,
              uuid: crypto.randomUUID()
            });
          if (eventError) throw eventError;
        }
      }
      
      // Handle cleaner assignment for all events
      const allEventUuids = [];
      
      // Collect all event UUIDs (both original and new ones)
      for (let i = 0; i < eventDates.length; i++) {
        const dates = eventDates[i];
        
        if (i === 0) {
          // First event is the original event being edited
          allEventUuids.push(editManualEvent.uuid);
        } else {
          // For new recurring events, find them by date and series ID
          const { data: event } = await supabase
            .from('events')
            .select('uuid')
            .eq('checkout_date', dates.checkOut.toISOString())
            .eq('recurring_series_id', recurringSeriesId)
            .single();
          
          if (event) {
            allEventUuids.push(event.uuid);
          }
        }
      }
      
      // First, remove all existing assignments for these events
      if (allEventUuids.length > 0) {
        const { error: deleteError } = await supabase
          .from('cleaner_assignments')
          .delete()
          .in('event_uuid', allEventUuids);
        
        if (deleteError) {
          console.error('Error removing existing assignments:', deleteError);
          // Don't throw here - continue with creating new assignments
        }
      }
      
      // If a cleaner is selected, create new assignments for all events
      if (editForm.selectedCleaner !== 'none' && allEventUuids.length > 0) {
        const assignmentsToCreate = allEventUuids.map(eventUuid => ({
          event_uuid: eventUuid,
          cleaner_uuid: editForm.selectedCleaner,
          hours: listingHours,
          is_active: true
        }));
        
        const { error: assignError } = await supabase
          .from('cleaner_assignments')
          .insert(assignmentsToCreate);
        
        if (assignError) throw assignError;
      }
      
      toast.success(editForm.isRecurring ? 'Recurring events created successfully' : 'Manual event updated successfully');
      setEditManualEvent(null);
      
      // Refresh calendar data
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      console.error('Error updating manual event:', error);
      toast.error('Failed to update manual event');
    }
  };
  
  // Add countdown timer effect
  useEffect(() => {
    if (!debugMode) return; // Only run countdown when debug mode is enabled
    
    let countdownInterval: NodeJS.Timeout;
    
    const updateCountdown = () => {
      setNextRefreshIn(prev => {
        if (prev <= 0) {
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    };
    
    // Start countdown
    countdownInterval = setInterval(updateCountdown, 1000);
    
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [debugMode]); // Add debugMode to dependencies
  
  // Add function to get surrounding events
  const getSurroundingEvents = (event: CalendarEvent) => {
    if (!event) return { prevCheckout: null, nextCheckin: null, sameDay: { found: false, events: [] } };
    
    const eventDate = new Date(event.end);
    const eventDateStr = eventDate.toISOString().split('T')[0];
    
    // Find all check-ins on the same day as this checkout
    const sameDayCheckins = filteredEvents.filter(e => 
      e.isCheckIn && 
      e.listing === event.listing && 
      new Date(e.start).toISOString().split('T')[0] === eventDateStr
    );
    
    // Find the next check-in for this listing after this checkout
    const nextCheckin = filteredEvents.find(e => 
      e.isCheckIn && 
      e.listing === event.listing && 
      new Date(e.start) > eventDate
    );
    
    // Find the previous checkout for this listing before this checkout
    const prevCheckout = filteredEvents.find(e => 
      e.isCheckOut && 
      e.listing === event.listing && 
      new Date(e.end) < eventDate && 
      e.id !== event.id
    );
    
    return { 
      prevCheckout, 
      nextCheckin,
      sameDay: {
        found: sameDayCheckins.length > 0,
        events: sameDayCheckins
      }
    };
  };

  // Add the event details dialog render function
  const renderEventDetailsDialog = () => {
    if (!selectedEventForDetails) return null;
    
    const { prevCheckout, nextCheckin, sameDay } = getSurroundingEvents(selectedEventForDetails);
    const formatEventDate = (date: Date | string) => format(new Date(date), 'MMM d, yyyy HH:mm', { locale: enUS });
    
    // Get the checkout date for comparison
    const checkoutDate = new Date(selectedEventForDetails.end).toISOString().split('T')[0];
    
    return (
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <h3 className="font-semibold">Current Event</h3>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Listing:</span> {selectedEventForDetails.listing}</p>
                  <p><span className="font-medium">Event ID:</span> {selectedEventForDetails.uuid || selectedEventForDetails.eventId}</p>
                  <p><span className="font-medium">Type:</span> {selectedEventForDetails.checkoutType || 'unknown'}</p>
                  <p><span className="font-medium">Check-in:</span> {formatEventDate(selectedEventForDetails.start)}</p>
                  <p><span className="font-medium">Check-out:</span> {formatEventDate(selectedEventForDetails.end)}</p>
                  <p><span className="font-medium">Assigned Cleaner:</span> {assignedCleaners[selectedEventForDetails.uuid || selectedEventForDetails.id] || 'None'}</p>
                </div>
              </div>
              
              <div className="grid gap-2">
                <h3 className="font-semibold">Type Verification</h3>
                <div className="text-sm space-y-2 bg-gray-50 p-2 rounded">
                  <p><span className="font-medium">Marked as:</span> {selectedEventForDetails.checkoutType || 'unknown'}</p>
                  <p><span className="font-medium">Checkout Date:</span> {checkoutDate}</p>
                  {sameDay.found ? (
                    <div>
                      <p className="text-green-600">✓ Found {sameDay.events.length} check-in(s) on checkout date:</p>
                      {sameDay.events.map((e, i) => (
                        <p key={i} className="ml-2 text-xs">
                          • {e.listing}: {formatEventDate(e.start)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-amber-600">⚠️ No check-ins found on checkout date. Should be marked as "open".</p>
                  )}
                </div>
              </div>
              
              <div className="grid gap-2">
                <h3 className="font-semibold">Surrounding Events</h3>
                <div className="text-sm space-y-3">
                  {prevCheckout && (
                    <div>
                      <p className="font-medium text-gray-600">Previous Checkout:</p>
                      <p>Date: {formatEventDate(prevCheckout.end)}</p>
                    </div>
                  )}
                  {nextCheckin && (
                    <div>
                      <p className="font-medium text-gray-600">Next Check-in:</p>
                      <p>Date: {formatEventDate(nextCheckin.start)}</p>
                      <p className="text-xs text-gray-500">
                        Gap: {differenceInDays(new Date(nextCheckin.start), new Date(selectedEventForDetails.end))} days
                      </p>
                    </div>
                  )}
                  {!nextCheckin && <p className="text-gray-500">No upcoming check-ins found</p>}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  
  if (isLoading || isLoadingCleaners) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-500">Loading calendar data...</p>
      </div>
    );
  }

  return (
    <>
      {/* Place the dialogs at the top level */}
      {renderCleanerAssignmentDialog()}
      {renderBulkAssignDialog()}
      {showCheckoutTimeModal && (
        <Dialog open={showCheckoutTimeModal} onOpenChange={setShowCheckoutTimeModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Checkout Time</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Checkout Time
                  </label>
                  <div className="flex items-center justify-center space-x-2">
                    {/* Hours input */}
                    <div className="relative flex flex-col items-center gap-2">
                      <button 
                        type="button"
                        onClick={incrementHours}
                        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Increase hours"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <input
                        type="text"
                        value={hoursInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          const numValue = parseInt(value);
                          if (value === '' || (numValue >= 0 && numValue <= 23)) {
                            setHoursInput(value);
                          }
                        }}
                        className="block w-16 rounded-md border border-gray-300 py-2 px-3 text-center text-lg"
                        placeholder="HH"
                        maxLength={2}
                      />
                      <button 
                        type="button"
                        onClick={decrementHours}
                        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Decrease hours"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <span className="text-xl font-medium">:</span>
                    
                    {/* Minutes input */}
                    <div className="relative flex flex-col items-center gap-2">
                      <button 
                        type="button"
                        onClick={incrementMinutes}
                        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Increase minutes"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <input
                        type="text"
                        value={minutesInput}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          const numValue = parseInt(value);
                          if (value === '' || (numValue >= 0 && numValue <= 59)) {
                            setMinutesInput(value);
                          }
                        }}
                        className="block w-16 rounded-md border border-gray-300 py-2 px-3 text-center text-lg"
                        placeholder="MM"
                        maxLength={2}
                      />
                      <button 
                        type="button"
                        onClick={decrementMinutes}
                        className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                        aria-label="Decrease minutes"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    24-hour format (00-23 for hours, 00-59 for minutes)
                  </p>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCheckoutTimeModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={updateCheckoutTime}
                    disabled={isUpdatingCheckoutTime}
                  >
                    {isUpdatingCheckoutTime ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      <div className="calendar-container">
        {/* Calendar header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            {debugMode && (
              <div className="flex items-center text-sm text-muted-foreground gap-2">
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500">
                    Next refresh in {Math.floor(nextRefreshIn / 60)}:{(nextRefreshIn % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-x-2 flex flex-wrap items-center gap-y-2">
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
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Previous
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
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>

        {/* Add style tag for mobile styles */}
        <style>{mobileStyles}</style>

        {/* Calendar Grid */}
        <div className="calendar-grid border rounded-lg overflow-hidden bg-white p-4">
          {viewMode === 'month' && (
            <div className="text-center mb-3">
              <h3 className="text-xl font-semibold text-gray-800">
                {format(currentDate, 'MMMM yyyy', { locale: enUS })}
              </h3>
            </div>
          )}
          
          {/* Days of the week header */}
          {isMobile ? (
            <div className="mb-2 text-center">
              <div className="text-sm font-medium text-gray-500">
                Swipe to navigate {viewMode === 'week' ? 'days' : 'weeks'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 border-b">
              {weekDays.map(day => (
                <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>
          )}

          {/* Calendar days */}
          {isMobile && viewMode === 'week' ? (
            // Mobile week view with horizontal scrolling
            <div 
              ref={calendarRef}
              className="calendar-container overflow-x-auto"
            >
              <div className="calendar-week-view flex">
                {days.map(day => {
                  const dayStatus = getDayStatus(day);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const isInViewedWeek = dayStatus?.isInViewedWeek || false;
                  const hasCheckouts = dayStatus && (dayStatus.sameDayCheckouts.length > 0 || dayStatus.regularCheckouts.length > 0);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toString()}
                      onClick={() => setSelectedDay(day)}
                      className={`
                        calendar-day p-3 border-r min-h-[300px] relative
                        ${isSelected ? 'bg-blue-50' : ''}
                        ${isToday ? 'border-t-2 border-t-blue-500' : ''}
                        ${isInViewedWeek && !isSelected ? 'bg-gray-50' : ''}
                        hover:bg-gray-50 cursor-pointer
                      `}
                    >
                      <div className="text-center mb-2">
                        <div className="font-medium">{format(day, 'EEE', { locale: enUS })}</div>
                        <div className="text-xl font-bold">{format(day, 'd', { locale: enUS })}</div>
                      </div>
                      
                      {/* Add "Assign All" button if day has checkouts */}
                      {hasCheckouts && (
                        <div className="mt-1 mb-1 grid grid-cols-2 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 bg-blue-50 hover:bg-blue-100 border-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBulkAssignDialog(day);
                            }}
                          >
                            Assign All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              bulkUnassignCleaners(day);
                            }}
                          >
                            Unassign All
                          </Button>
                        </div>
                      )}
                      
                      {dayStatus && (
                        <div className="mt-1 flex flex-col gap-1">
                          {/* Same day checkouts first */}
                          {dayStatus.sameDayCheckouts.map((event, idx) => (
                            <div 
                              key={`same-day-checkout-${event.id}-${idx}`}
                              className={`text-xs px-1.5 py-1 my-0.5 rounded border-l-2 ${
                                event.eventType === 'manual' ? 'border-yellow-500 bg-yellow-50' : assignedCleaners[event.id] 
                                  ? 'border-purple-500 bg-purple-50' 
                                  : 'border-purple-500 bg-white'
                              }`}
                              onClick={event.eventType === 'manual' ? (e) => { e.stopPropagation(); openEditManualEventDialog(event); } : undefined}
                            >
                              <div className="font-bold text-purple-700 flex justify-between items-center text-[11px]">
                                <span>SAME DAY</span>
                                {assignedCleaners[event.id] && (
                                  <span className="text-purple-600 font-normal bg-purple-50 px-1 rounded text-[11px]">
                                    {assignedCleaners[event.id]}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium truncate text-gray-800 text-xs">
                                {event.listing || 'Unnamed'}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-600">
                                    {formatCheckoutTime(event.checkoutTime) || '-'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCheckoutTimeModal(event.uuid || event.eventId || event.id || '', event.checkoutTime);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    aria-label="Edit checkout time"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {debugMode && (event.uuid || event.eventId) && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-5 text-[10px] px-1" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventForDetails(event);
                                        setShowEventDetails(true);
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  )}
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-xs border-dashed" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.eventType === 'manual') {
                                      openEditManualEventDialog(event);
                                    } else {
                                      openAssignDialog(event.id);
                                    }
                                  }}
                                >
                                  {event.eventType === 'manual' ? 'Edit' : assignedCleaners[event.id] ? 'Reassign' : 'Assign'}
                                </Button>
                              </div>
                              {event.eventType === 'manual' && (
                                <span className="inline-block text-[10px] bg-yellow-200 text-yellow-900 rounded px-1 ml-1 align-middle">Manual</span>
                              )}
                              {event.recurrence_type && (
                                <span className="inline-block text-[10px] bg-green-200 text-green-900 rounded px-1 ml-1 align-middle">Recurring</span>
                              )}
                            </div>
                          ))}
                          
                          {/* Regular checkouts next */}
                          {dayStatus.regularCheckouts.map((event, idx) => (
                            <div 
                              key={`regular-checkout-${event.id}-${idx}`}
                              className={`text-xs px-1.5 py-1 my-0.5 rounded border-l-2 ${
                                event.eventType === 'manual' ? 'border-yellow-500 bg-yellow-50' : assignedCleaners[event.id] 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-blue-500 bg-white'
                              }`}
                              onClick={event.eventType === 'manual' ? (e) => { e.stopPropagation(); openEditManualEventDialog(event); } : undefined}
                            >
                              <div className="font-bold text-blue-700 flex justify-between items-center text-[11px]">
                                <span>OPEN</span>
                                {assignedCleaners[event.id] && (
                                  <span className="text-blue-600 font-normal bg-blue-50 px-1 rounded text-[11px]">
                                    {assignedCleaners[event.id]}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium truncate text-gray-800 text-xs">
                                {event.listing || 'Unnamed'}
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-gray-600">
                                    {formatCheckoutTime(event.checkoutTime) || '-'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCheckoutTimeModal(event.uuid || event.eventId || event.id || '', event.checkoutTime);
                                    }}
                                    className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    aria-label="Edit checkout time"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  {debugMode && (event.uuid || event.eventId) && (
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-5 text-[10px] px-1" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEventForDetails(event);
                                        setShowEventDetails(true);
                                      }}
                                    >
                                      View Details
                                    </Button>
                                  )}
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-6 text-xs border-dashed" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.eventType === 'manual') {
                                      openEditManualEventDialog(event);
                                    } else {
                                      openAssignDialog(event.id);
                                    }
                                  }}
                                >
                                  {event.eventType === 'manual' ? 'Edit' : assignedCleaners[event.id] ? 'Reassign' : 'Assign'}
                                </Button>
                              </div>
                              {event.eventType === 'manual' && (
                                <span className="inline-block text-[10px] bg-yellow-200 text-yellow-900 rounded px-1 ml-1 align-middle">Manual</span>
                              )}
                              {event.recurrence_type && (
                                <span className="inline-block text-[10px] bg-green-200 text-green-900 rounded px-1 ml-1 align-middle">Recurring</span>
                              )}
                            </div>
                          ))}
                          
                          {/* Show check-ins when enabled */}
                          {showCheckIns && dayStatus.checkIns
                            // Filter out check-ins that have a matching same-day checkout
                            .filter(checkIn => {
                              // Don't show check-ins that match a same-day checkout
                              const hasSameDayCheckout = dayStatus.sameDayCheckouts.some(
                                checkout => checkout.listing === checkIn.listing
                              );
                              return !hasSameDayCheckout;
                            })
                            .map((event, idx) => (
                            <div 
                              key={`checkin-${event.id}-${idx}`}
                              className="text-xs px-1.5 py-1 my-0.5 rounded border-l-2 border-green-500 bg-green-50"
                            >
                              <div className="font-bold text-green-700 flex justify-between items-center text-[11px]">
                                <span>CHECKIN</span>
                              </div>
                              <div className="font-medium truncate text-gray-800 text-xs">
                                {event.listing || 'Unnamed'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : isMobile && viewMode === 'month' ? (
            // Mobile month view with horizontal scrolling by week
            <div 
              ref={calendarRef}
              className="calendar-month-grid"
            >
              {weeksByDays.map((week, weekIndex) => {
                const hasEvents = week.some(day => day && getDayStatus(day)?.hasEvents);
                const weekStart = week[0];
                const weekEnd = week[6];
                
                return (
                  <div key={`week-${weekIndex}`} className="calendar-month-week">
                    <div className="text-center py-2 border-b">
                      <div className="text-sm text-gray-500">
                        {weekStart && weekEnd ? (
                          `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
                        ) : 'Week ' + (weekIndex + 1)}
                      </div>
                    </div>
                    
                    {/* Days grid */}
                    <div className="calendar-month-days">
                      {weekDays.map((dayName, i) => (
                        <div key={dayName} className="text-xs font-medium text-gray-500 p-1 text-center border-b">
                          {dayName}
                        </div>
                      ))}
                      {week.map((day, dayIndex) => {
                        if (!day) return (
                          <div key={`empty-${dayIndex}`} className="calendar-month-day" />
                        );
                        
                        const dayStatus = getDayStatus(day);
                        const isToday = isSameDay(day, new Date());
                        const hasEvents = dayStatus?.hasEvents;
                        const hasCheckouts = dayStatus && (dayStatus.sameDayCheckouts.length > 0 || dayStatus.regularCheckouts.length > 0);
                        
                        return (
                          <div
                            key={day.toString()}
                            onClick={() => setSelectedDay(day)}
                            className={`calendar-month-day ${hasEvents ? 'has-events' : ''} ${isToday ? 'today' : ''}`}
                          >
                            <span className="text-sm font-medium">{format(day, 'd')}</span>
                            {hasEvents && (
                              <div className="mt-1 flex gap-1">
                                {dayStatus?.sameDayCheckouts.length > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                                )}
                                {dayStatus?.regularCheckouts.length > 0 && (
                                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Events list */}
                    {hasEvents && (
                      <div className="calendar-month-events">
                        {week.filter(Boolean).map((day) => {
                          const dayStatus = getDayStatus(day);
                          if (!dayStatus?.hasEvents) return null;
                          
                          const allEvents = [
                            ...dayStatus.sameDayCheckouts.map(event => ({ ...event, type: 'same-day' })),
                            ...dayStatus.regularCheckouts.map(event => ({ ...event, type: 'checkout' }))
                          ];
                          
                          if (allEvents.length === 0) return null;

                          const hasCheckouts = dayStatus.sameDayCheckouts.length > 0 || dayStatus.regularCheckouts.length > 0;
                          
                          return (
                            <div key={day.toString()} className="calendar-event-group">
                              <div className="calendar-event-date">
                                <span>{format(day, 'EEE, MMM d')}</span>
                                {hasCheckouts && (
                                  <div className="calendar-event-date-actions">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBulkAssignDialog(day);
                                      }}
                                    >
                                      Assign All
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {allEvents.map((event) => (
                                <div
                                  key={event.uuid}
                                  className={`calendar-event-item ${
                                    event.eventType === 'manual' 
                                      ? 'manual'
                                      : event.type === 'same-day' 
                                        ? 'same-day' 
                                        : 'open'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.eventType === 'manual') {
                                      openEditManualEventDialog(event);
                                    }
                                  }}
                                >
                                  <div className="calendar-event-header">
                                    <span className="calendar-event-type">
                                      {event.eventType === 'manual'
                                        ? event.checkoutType === 'same_day' ? 'SAME DAY' : 'OPEN'
                                        : event.type === 'same-day' ? 'SAME DAY' : 'OPEN'
                                      }
                                    </span>
                                    {assignedCleaners[event.uuid] && (
                                      <span className="calendar-event-cleaner">
                                        {assignedCleaners[event.uuid]}
                                      </span>
                                    )}
                                  </div>
                                  <div className="calendar-event-listing">
                                    <span>{event.listing || 'Unnamed'}</span>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="h-6 text-xs" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (event.eventType === 'manual') {
                                          openEditManualEventDialog(event);
                                        } else {
                                          openAssignDialog(event.uuid);
                                        }
                                      }}
                                    >
                                      {event.eventType === 'manual' ? 'Edit' : assignedCleaners[event.uuid] ? 'Reassign' : 'Assign'}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // Desktop view (original layout)
            <div className="grid grid-cols-7">
              {viewMode === 'month' && 
                // Add empty cells for days before the 1st of the month
                // Convert Sunday (0) to position 7, and adjust others to match Mon-Sun layout (1-7)
                Array.from({ length: days[0].getDay() === 0 ? 6 : days[0].getDay() - 1 }, (_, i) => (
                  <div key={`empty-start-${i}`} className="min-h-[120px] p-3 border-b border-r"></div>
                ))
              }
              
              {days.map(day => {
                const dayStatus = getDayStatus(day);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const isInViewedWeek = dayStatus?.isInViewedWeek || false;
                const hasCheckouts = dayStatus && (dayStatus.sameDayCheckouts.length > 0 || dayStatus.regularCheckouts.length > 0);
                
                return (
                  <div
                    key={day.toString()}
                    onClick={() => setSelectedDay(day)}
                    className={`
                      min-h-[120px] p-3 border-b border-r relative
                      ${isSelected ? 'bg-blue-50' : ''}
                      ${isInViewedWeek && !isSelected ? 'bg-gray-50' : ''}
                      hover:bg-gray-50 cursor-pointer
                    `}
                  >
                    <div className="text-sm flex justify-between">
                      <span>{format(day, 'd', { locale: enUS })}</span>
                      {dayStatus && dayStatus.eventCount > 0 && (
                        <span className="text-xs bg-gray-100 px-1 rounded-full">
                          {dayStatus.eventCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Add "Assign All" and "Unassign All" buttons if day has checkouts */}
                                          {hasCheckouts && (
                        <div className="mt-1 mb-1 grid grid-cols-2 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-5 bg-blue-50 hover:bg-blue-100 border-blue-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBulkAssignDialog(day);
                            }}
                          >
                            Assign All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] h-5 bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              bulkUnassignCleaners(day);
                            }}
                          >
                            Unassign All
                          </Button>
                        </div>
                      )}
                    
                    {dayStatus && (
                      <div className="mt-1 flex flex-col gap-1">
                        {/* Same day checkouts first */}
                        {dayStatus.sameDayCheckouts.map((event, idx) => (
                          <div 
                            key={`same-day-checkout-${event.id}-${idx}`}
                            className={`text-xs px-1.5 py-1 my-0.5 rounded border-l-2 ${
                              event.eventType === 'manual' ? 'border-yellow-500 bg-yellow-50' : assignedCleaners[event.id] 
                                ? 'border-purple-500 bg-purple-50' 
                                : 'border-purple-500 bg-white'
                            }`}
                            onClick={event.eventType === 'manual' ? (e) => { e.stopPropagation(); openEditManualEventDialog(event); } : undefined}
                          >
                            <div className="font-bold flex justify-between items-center text-[11px]">
                              <span className={event.eventType === 'manual' ? 'text-yellow-700' : 'text-purple-700'}>
                                {event.eventType === 'manual' ? (event.checkoutType === 'same_day' ? 'SAME DAY' : 'OPEN') : 'SAME DAY'}
                              </span>
                              {assignedCleaners[event.id] && (
                                <span className={`font-normal px-1 rounded text-[11px] ${
                                  event.eventType === 'manual' ? 'text-yellow-600 bg-yellow-50' : 'text-purple-600 bg-purple-50'
                                }`}>
                                  {assignedCleaners[event.id]}
                                </span>
                              )}
                            </div>
                            <div className="font-medium truncate text-gray-800 text-xs">
                              {event.listing || 'Unnamed'}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-600">
                                  {formatCheckoutTime(event.checkoutTime) || '-'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCheckoutTimeModal(event.uuid || event.eventId || event.id || '', event.checkoutTime);
                                  }}
                                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                  aria-label="Edit checkout time"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {debugMode && (event.uuid || event.eventId) && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-5 text-[10px] px-1" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventForDetails(event);
                                      setShowEventDetails(true);
                                    }}
                                  >
                                    View Details
                                  </Button>
                                )}
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-6 text-xs border-dashed" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (event.eventType === 'manual') {
                                    openEditManualEventDialog(event);
                                  } else {
                                    openAssignDialog(event.id);
                                  }
                                }}
                              >
                                {event.eventType === 'manual' ? 'Edit' : assignedCleaners[event.id] ? 'Reassign' : 'Assign'}
                              </Button>
                            </div>
                            {event.eventType === 'manual' && (
                              <span className="inline-block text-[10px] bg-yellow-200 text-yellow-900 rounded px-1 ml-1 align-middle">Manual</span>
                            )}
                            {event.recurrence_type && (
                              <span className="inline-block text-[10px] bg-green-200 text-green-900 rounded px-1 ml-1 align-middle">Recurring</span>
                            )}
                          </div>
                        ))}
                        
                        {/* Regular checkouts next */}
                        {dayStatus.regularCheckouts.map((event, idx) => (
                          <div 
                            key={`regular-checkout-${event.id}-${idx}`}
                            className={`text-xs px-1.5 py-1 my-0.5 rounded border-l-2 ${
                              event.eventType === 'manual' ? 'border-yellow-500 bg-yellow-50' : assignedCleaners[event.id] 
                                ? 'border-blue-500 bg-blue-50' 
                                : 'border-blue-500 bg-white'
                            }`}
                            onClick={event.eventType === 'manual' ? (e) => { e.stopPropagation(); openEditManualEventDialog(event); } : undefined}
                          >
                            <div className="font-bold flex justify-between items-center text-[11px]">
                              <span className={event.eventType === 'manual' ? 'text-yellow-700' : 'text-blue-700'}>
                                {event.eventType === 'manual' ? (event.checkoutType === 'same_day' ? 'SAME DAY' : 'OPEN') : 'OPEN'}
                              </span>
                              {assignedCleaners[event.id] && (
                                <span className={`font-normal px-1 rounded text-[11px] ${
                                  event.eventType === 'manual' ? 'text-yellow-600 bg-yellow-50' : 'text-blue-600 bg-blue-50'
                                }`}>
                                  {assignedCleaners[event.id]}
                                </span>
                              )}
                            </div>
                            <div className="font-medium truncate text-gray-800 text-xs">
                              {event.listing || 'Unnamed'}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-gray-600">
                                  {formatCheckoutTime(event.checkoutTime) || '-'}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCheckoutTimeModal(event.uuid || event.eventId || event.id || '', event.checkoutTime);
                                  }}
                                  className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                  aria-label="Edit checkout time"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                {debugMode && (event.uuid || event.eventId) && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-5 text-[10px] px-1" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEventForDetails(event);
                                      setShowEventDetails(true);
                                    }}
                                  >
                                    View Details
                                  </Button>
                                )}
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-6 text-xs border-dashed" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (event.eventType === 'manual') {
                                    openEditManualEventDialog(event);
                                  } else {
                                    openAssignDialog(event.id);
                                  }
                                }}
                              >
                                {event.eventType === 'manual' ? 'Edit' : assignedCleaners[event.id] ? 'Reassign' : 'Assign'}
                              </Button>
                            </div>
                            {event.eventType === 'manual' && (
                              <span className="inline-block text-[10px] bg-yellow-200 text-yellow-900 rounded px-1 ml-1 align-middle">Manual</span>
                            )}
                            {event.recurrence_type && (
                              <span className="inline-block text-[10px] bg-green-200 text-green-900 rounded px-1 ml-1 align-middle">Recurring</span>
                            )}
                          </div>
                        ))}
                        
                        {/* Show check-ins when enabled */}
                        {showCheckIns && dayStatus.checkIns
                          .filter(checkIn => {
                            const hasSameDayCheckout = dayStatus.sameDayCheckouts.some(
                              checkout => checkout.listing === checkIn.listing
                            );
                            return !hasSameDayCheckout;
                          })
                          .map((event, idx) => (
                          <div 
                            key={`checkin-${event.id}-${idx}`}
                            className="text-xs px-1.5 py-1 my-0.5 rounded border-l-2 border-green-500 bg-green-50"
                          >
                            <div className="font-bold text-green-700 flex justify-between items-center text-[11px]">
                              <span>CHECKIN</span>
                            </div>
                            <div className="font-medium truncate text-gray-800 text-xs">
                              {event.listing || 'Unnamed'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {renderEditManualEventDialog()}
      {renderEventDetailsDialog()}
    </>
  );
}

