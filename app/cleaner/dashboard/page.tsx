'use client';

import { useState, useEffect } from 'react';
import { useCleanerAuth, CleanerProtectedRoute } from '@/lib/cleaner-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addDays, format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';
import { LogOut, RefreshCw, Calendar as CalendarIcon, Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CleanerEventAssignment, getCleanerUpcomingAssignments } from '@/lib/calendar-models';
import { useRouter, usePathname } from 'next/navigation';
import { CleanerCalendar } from '@/app/components/cleaner-calendar';
import Link from 'next/link';

// Define an interface for the event from the new schema
interface Event {
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
}

// Extended interface to include the joined entities from the database query
interface CleanerAssignmentWithEvent extends CleanerEventAssignment {
  event?: Event;
}

export default function CleanerDashboard() {
  return (
    <CleanerProtectedRoute>
      <CleanerDashboardContent />
    </CleanerProtectedRoute>
  );
}

function CleanerDashboardContent() {
  const { cleaner, logout, isLoading } = useCleanerAuth();
  const [assignments, setAssignments] = useState<CleanerAssignmentWithEvent[]>([]);
  const [allAssignments, setAllAssignments] = useState<CleanerAssignmentWithEvent[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !cleaner) {
      console.log('No cleaner found in dashboard, redirecting');
      router.replace('/cleaner/login');
    }
  }, [cleaner, isLoading, router]);

  // Load assignments when cleaner is available
  useEffect(() => {
    if (cleaner && cleaner.uuid) {
      console.log('Cleaner authenticated, loading assignments');
      loadAssignments();
    }
  }, [cleaner]);

  // Auto-sync assignments with database periodically
  useEffect(() => {
    if (!cleaner || !cleaner.uuid) return;
    
    // Initial load
    loadAssignments();
    
    // Set up interval for polling (every 5 seconds)
    const intervalId = setInterval(() => {
      console.log('Auto-syncing assignments data');
      // Use the syncing state flag instead of loading for incremental updates
      setIsSyncing(true);
      loadAssignments(true);
    }, 5000); // 5 seconds interval
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [cleaner]);

  // Load assignments for the current cleaner
  const loadAssignments = async (isAutoSync = false) => {
    if (!cleaner || !cleaner.uuid) {
      console.log('No cleaner or cleaner UUID available, skipping assignment load');
      return;
    }
    
    console.log(`Loading assignments for cleaner ${cleaner.uuid} (${cleaner.name})`);
    
    // Only show main loading indicator for initial or manual loads
    if (!isAutoSync) {
      setIsLoadingData(true);
    }

    try {
      console.log('Calling getCleanerUpcomingAssignments...');
      const data = await getCleanerUpcomingAssignments(cleaner.uuid);
      console.log('Received assignments:', data);
      
      // Update assignment hours based on listing_hours from event
      const updatedAssignments = data.activeAssignments.map(assignment => {
        if (assignment.event?.listing_hours) {
          const hours = parseFloat(assignment.event.listing_hours) || assignment.hours;
          return {
            ...assignment,
            hours: hours
          };
        }
        return assignment;
      });

      const updatedAllAssignments = data.allAssignments.map(assignment => {
        if (assignment.event?.listing_hours) {
          const hours = parseFloat(assignment.event.listing_hours) || assignment.hours;
          return {
            ...assignment,
            hours: hours
          };
        }
        return assignment;
      });
      
      // Set both active assignments for the calendar and all assignments for debug
      setAssignments(updatedAssignments);
      setAllAssignments(updatedAllAssignments);
      
      console.log(`Set ${updatedAssignments.length} active assignments in state`);
      console.log(`Set ${updatedAllAssignments.length} total assignments in debug state`);
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setIsLoadingData(false);
      setIsSyncing(false);
    }
  };

  // Create a human-readable summary of events by day of week and which week they belong to
  const summarizeEventsByDay = (data: CleanerAssignmentWithEvent[]) => {
    const today = new Date();
    const currentWeek = getCurrentWeekBoundaries(today);
    const nextWeek = getCurrentWeekBoundaries(addDays(today, 7));
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Create buckets for current week, next week, and other
    const summary: {
      'Current Week': Array<Array<{listing: string, date: string}>>;
      'Next Week': Array<Array<{listing: string, date: string}>>;
      'Other': Array<Array<{listing: string, date: string}>>;
      [key: string]: Array<Array<{listing: string, date: string}>>;
    } = {
      'Current Week': Array(7).fill(0).map(() => []),
      'Next Week': Array(7).fill(0).map(() => []),
      'Other': Array(7).fill(0).map(() => [])
    };
    
    data.forEach(assignment => {
      if (!assignment.event) return;
      
      const date = new Date(assignment.event.checkout_date);
      if (isNaN(date.getTime())) return;
      
      const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      let weekType = 'Other';
      if (date >= currentWeek.start && date <= currentWeek.end) {
        weekType = 'Current Week';
      } else if (date >= nextWeek.start && date <= nextWeek.end) {
        weekType = 'Next Week';
      }
      
      // Add a simplified version of the assignment to the appropriate bucket
      summary[weekType][dayIndex].push({
        listing: assignment.event.listing_name,
        date: format(date, 'yyyy-MM-dd')
      });
    });
    
    // Convert to a more readable format
    const readableSummary: Record<string, Record<string, any[]>> = {};
    
    for (const [weekType, days] of Object.entries(summary)) {
      readableSummary[weekType] = {};
      
      days.forEach((events, index) => {
        const dayName = dayNames[index];
        readableSummary[weekType][dayName] = events;
      });
    }
    
    return readableSummary;
  };

  // Helper function to get week boundaries (Monday to Sunday)
  const getCurrentWeekBoundaries = (date: Date) => {
    // Get Monday (weekStartsOn: 1) of the week
    const start = startOfWeek(date, { weekStartsOn: 1 });
    // Get Sunday of the week
    const end = endOfWeek(date, { weekStartsOn: 1 });
    return { start, end };
  };

  // Get the current date range for the calendar
  const getDateRange = () => {
    // Start with current date in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    // Get Monday of current week
    const currentWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
    currentWeekMonday.setUTCHours(0, 0, 0, 0);
    
    // Get Sunday of next week (end of the second week)
    const nextWeekSunday = endOfWeek(addDays(currentWeekMonday, 7), { weekStartsOn: 1 });
    nextWeekSunday.setUTCHours(23, 59, 59, 999);
    
    return {
      start: currentWeekMonday,
      end: nextWeekSunday,
      startStr: format(currentWeekMonday, 'MMM d, yyyy'),
      endStr: format(nextWeekSunday, 'MMM d, yyyy'),
      startDay: format(currentWeekMonday, 'EEEE'),
      endDay: format(nextWeekSunday, 'EEEE')
    };
  };

  // Get active assignments in the current date range
  const getActiveAssignmentsInRange = () => {
    const { start, end } = getDateRange();
    
    console.log('Getting active assignments in range:', {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });

    const filtered = allAssignments.filter((assignment: CleanerAssignmentWithEvent) => {
      if (!assignment.event?.checkout_date) {
        console.log('In range check - No checkout date:', assignment.uuid);
        return false;
      }

      // Check if assignment is active first
      if (!assignment.is_active || !assignment.event.is_active) {
        console.log('In range check - Skipped inactive:', {
          id: assignment.uuid,
          assignmentActive: assignment.is_active,
          eventActive: assignment.event.is_active
        });
        return false;
      }
      
      try {
        // Convert all dates to UTC midnight for comparison
        const checkoutDate = new Date(assignment.event.checkout_date);
        const checkoutDateStart = new Date(checkoutDate);
        checkoutDateStart.setUTCHours(0, 0, 0, 0);
        const checkoutDateEnd = new Date(checkoutDate);
        checkoutDateEnd.setUTCHours(23, 59, 59, 999);

        const startDay = new Date(start);
        startDay.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setUTCHours(23, 59, 59, 999);

        const isInRange = checkoutDateStart >= startDay && checkoutDateEnd <= endDay;
        
        console.log('In range check:', {
          id: assignment.uuid,
          listingName: assignment.event.listing_name,
          checkoutDate: assignment.event.checkout_date,
          isInRange,
          dateComparison: {
            checkoutStart: checkoutDateStart.toISOString(),
            checkoutEnd: checkoutDateEnd.toISOString(),
            rangeStart: startDay.toISOString(),
            rangeEnd: endDay.toISOString()
          }
        });

        return isInRange;
      } catch (error) {
        console.error('Date parsing error for in range check:', assignment.uuid, error);
        return false;
      }
    });

    console.log('In range assignments summary:', {
      total: allAssignments.length,
      filtered: filtered.length,
      excluded: allAssignments.length - filtered.length,
      inRangeIds: filtered.map((a: CleanerAssignmentWithEvent) => a.uuid)
    });

    return filtered;
  };

  // Get active assignments that are not in the current date range
  const getActiveAssignmentsOutOfRange = () => {
    const { start, end } = getDateRange();
    
    console.log('Checking out-of-range assignments:', {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
    
    const filtered = allAssignments.filter((assignment: CleanerAssignmentWithEvent) => {
      // First check if assignment is active
      if (!assignment.is_active || !assignment.event?.is_active) {
        console.log('Out of range check - Skipped inactive:', {
          id: assignment.uuid,
          assignmentActive: assignment.is_active,
          eventActive: assignment.event?.is_active
        });
        return false;
      }

      if (!assignment.event?.checkout_date) {
        console.log('Out of range check - No checkout date:', assignment.uuid);
        return false;
      }
      
      try {
        const checkoutDate = new Date(assignment.event.checkout_date);
        const checkoutDateStart = new Date(checkoutDate);
        checkoutDateStart.setUTCHours(0, 0, 0, 0);
        const checkoutDateEnd = new Date(checkoutDate);
        checkoutDateEnd.setUTCHours(23, 59, 59, 999);

        const startDay = new Date(start);
        startDay.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setUTCHours(23, 59, 59, 999);

        const isOutOfRange = checkoutDateEnd < startDay || checkoutDateStart > endDay;
        
        console.log('Out of range check:', {
          id: assignment.uuid,
          listingName: assignment.event.listing_name,
          checkoutDate: assignment.event.checkout_date,
          isOutOfRange,
          dateComparison: {
            beforeStart: checkoutDateEnd < startDay,
            afterEnd: checkoutDateStart > endDay
          }
        });
        
        return isOutOfRange;
      } catch (error) {
        console.error('Date parsing error for out of range check:', assignment.uuid, error);
        return false;
      }
    });

    console.log('Out of range assignments summary:', {
      total: allAssignments.length,
      filtered: filtered.length,
      excluded: allAssignments.length - filtered.length
    });

    return filtered;
  };

  // Get inactive assignments with reason
  const getInactiveAssignments = () => {
    console.log('Checking inactive assignments...');
    
    const filtered = allAssignments.filter((assignment: CleanerAssignmentWithEvent) => {
      const isInactive = !assignment.is_active || !assignment.event?.is_active;
      
      if (isInactive) {
        console.log('Found inactive assignment:', {
          id: assignment.uuid,
          listingName: assignment.event?.listing_name,
          checkoutDate: assignment.event?.checkout_date,
          assignmentActive: assignment.is_active,
          eventActive: assignment.event?.is_active,
          reason: !assignment.is_active ? 'Assignment Inactive' : 'Event Inactive'
        });
      }
      
      return isInactive;
    });

    console.log('Inactive assignments summary:', {
      total: allAssignments.length,
      filtered: filtered.length,
      excluded: allAssignments.length - filtered.length,
      inactiveAssignmentIds: filtered.map((a: CleanerAssignmentWithEvent) => a.uuid)
    });

    return filtered;
  };

  // Add a new helper function to analyze why an assignment isn't matching any category
  const analyzeAssignmentFiltering = (assignment: CleanerAssignmentWithEvent) => {
    const { start, end } = getDateRange();
    
    // Convert all dates to UTC midnight for comparison
    const startDay = new Date(start);
    startDay.setUTCHours(0, 0, 0, 0);
    
    const endDay = new Date(end);
    endDay.setUTCHours(23, 59, 59, 999);
    
    if (!assignment.event?.checkout_date) {
      return {
        result: 'no-date',
        details: 'Assignment has no checkout date'
      };
    }

    const checkoutDate = new Date(assignment.event.checkout_date);
    const checkoutDateStart = new Date(checkoutDate);
    checkoutDateStart.setUTCHours(0, 0, 0, 0);
    const checkoutDateEnd = new Date(checkoutDate);
    checkoutDateEnd.setUTCHours(23, 59, 59, 999);

    // Check activity status
    if (!assignment.is_active || !assignment.event.is_active) {
      return {
        result: 'inactive',
        details: !assignment.is_active ? 'Assignment is inactive' : 'Event is inactive',
        assignmentActive: assignment.is_active,
        eventActive: assignment.event.is_active
      };
    }

    // Check if in range
    const isInRange = checkoutDateStart >= startDay && checkoutDateEnd <= endDay;
    if (isInRange) {
      return { 
        result: 'in-range',
        details: 'Assignment is within date range',
        dateComparison: {
          checkoutStart: checkoutDateStart.toISOString(),
          checkoutEnd: checkoutDateEnd.toISOString(),
          rangeStart: startDay.toISOString(),
          rangeEnd: endDay.toISOString()
        }
      };
    }

    // Check if out of range
    const isOutOfRange = checkoutDateEnd < startDay || checkoutDateStart > endDay;
    if (isOutOfRange) {
      return { 
        result: 'out-of-range',
        details: checkoutDateEnd < startDay ? 'Before range start' : 'After range end',
        dateComparison: {
          checkoutStart: checkoutDateStart.toISOString(),
          checkoutEnd: checkoutDateEnd.toISOString(),
          rangeStart: startDay.toISOString(),
          rangeEnd: endDay.toISOString()
        }
      };
    }

    // If we get here, something is wrong with our logic
    return { 
      result: 'logic-error',
      details: 'Assignment doesn\'t match any category despite being active and having a date',
      dateComparison: {
        checkoutStart: checkoutDateStart.toISOString(),
        checkoutEnd: checkoutDateEnd.toISOString(),
        rangeStart: startDay.toISOString(),
        rangeEnd: endDay.toISOString(),
        rawCheckoutDate: assignment.event.checkout_date
      }
    };
  };

  // Helper function to format date for display
  const formatEventDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch (error) {
      return dateStr;
    }
  };

  // If auth is still loading or no cleaner, show loading state
  if (isLoading || !cleaner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {cleaner?.name}</h1>
            <p className="text-muted-foreground">
              View your cleaning assignments for the next two weeks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cleaner?.role === 'editor' && (
              <Button
                asChild
                variant="secondary"
                size="sm"
              >
                <a href="/cleaner/calendar">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Go to Calendar
                </a>
              </Button>
            )}
            <Button variant="ghost" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        
        <div className="space-y-5">
          <CleanerCalendar 
            assignments={allAssignments.filter(a => a.is_active && a.event?.is_active)}
            isLoadingData={isLoadingData}
            isSyncing={isSyncing}
            onRefreshNeeded={loadAssignments}
          />
        </div>
      </div>
    </div>
  );
}