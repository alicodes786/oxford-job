'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addDays, format, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { RefreshCw, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { CleanerEventAssignment } from '@/lib/calendar-models';
import { CleaningChecklistForm } from '@/components/CleaningChecklistForm';

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
  is_completed?: boolean;
  completed_at?: string;
}

interface CleanerCalendarProps {
  assignments: CleanerAssignmentWithEvent[];
  isLoadingData: boolean;
  isSyncing: boolean;
  onRefreshNeeded?: () => void;
}

export function CleanerCalendar({ assignments, isLoadingData, isSyncing, onRefreshNeeded }: CleanerCalendarProps) {
  // Start from Monday of the current week
  const getMonday = () => startOfWeek(new Date(), { weekStartsOn: 1 });
  const [currentDate, setCurrentDate] = useState(getMonday());
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [selectedAssignment, setSelectedAssignment] = useState<CleanerAssignmentWithEvent | null>(null);
  const [isCleaningFormOpen, setIsCleaningFormOpen] = useState(false);

  // Handle starting a job
  const handleStartJob = (assignment: CleanerAssignmentWithEvent) => {
    setSelectedAssignment(assignment);
    setIsCleaningFormOpen(true);
  };

  // Handle closing the cleaning form
  const handleCloseCleaningForm = () => {
    setIsCleaningFormOpen(false);
    setSelectedAssignment(null);
    // Trigger a refresh of assignments after form closes
    if (onRefreshNeeded) {
      onRefreshNeeded();
    }
  };

  // Helper function to calculate Monday-Sunday boundaries for any date
  const getWeekBoundaries = (date: Date) => {
    // Use Monday as start of week (1) instead of Sunday (0)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    return { weekStart, weekEnd };
  };

  // Get days for the current week
  const getDaysForCurrentWeek = () => {
    const { weekStart, weekEnd } = getWeekBoundaries(currentDate);
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  };

  // Get assignments for a specific day
  const getAssignmentsForDay = (day: Date) => {
    return assignments.filter(assignment => {
      if (!assignment.event) return false;
      try {
        const checkoutDate = new Date(assignment.event.checkout_date);
        // Use isSameDay to compare just the date portion, regardless of time or timezone
        return isSameDay(checkoutDate, day);
      } catch (error) {
        console.error('Error comparing dates in getAssignmentsForDay:', error);
        return false;
      }
    });
  };

  // Navigate to the next week
  const goToNextWeek = () => {
    // Only allow viewing up to 2 weeks beyond the current week
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const twoWeeksAheadStart = addDays(currentWeekStart, 14);
    const selectedWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    
    // If already viewing two weeks ahead, don't allow further navigation
    if (isSameDay(selectedWeekStart, twoWeeksAheadStart) || 
        selectedWeekStart > twoWeeksAheadStart) {
      return;
    }
    
    // Otherwise, go to next week
    setCurrentDate(prevDate => addDays(prevDate, 7));
  };

  // Navigate to the previous week
  const goToPreviousWeek = () => {
    // Only allow viewing up to 2 weeks (current and next week)
    const today = new Date();
    const { weekStart: currentWeekStart } = getWeekBoundaries(today);
    const { weekStart: selectedWeekStart } = getWeekBoundaries(currentDate);
    
    // If going back would take us before the current week, don't allow it
    if (selectedWeekStart > currentWeekStart) {
      setCurrentDate(prevDate => addDays(prevDate, -7));
    }
  };

  // Reset to current week
  const goToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  // Navigate to the next day (for daily view)
  const goToNextDay = () => {
    // Only allow viewing up to 2 weeks beyond the current day
    const today = new Date();
    const twoWeeksAhead = addDays(today, 14);
    
    // If already viewing two weeks ahead, don't allow further navigation
    if (currentDate >= twoWeeksAhead) {
      return;
    }
    
    // Otherwise, go to next day
    setCurrentDate(prevDate => addDays(prevDate, 1));
  };

  // Navigate to the previous day (for daily view)
  const goToPreviousDay = () => {
    // Only allow viewing current and future days
    const today = new Date();
    
    // If going back would take us before today, don't allow it
    if (currentDate > today) {
      setCurrentDate(prevDate => addDays(prevDate, -1));
    }
  };

  // Add function to sort assignments by priority
  const sortAssignmentsByPriority = (assignments: CleanerAssignmentWithEvent[]) => {
    return [...assignments].sort((a, b) => {
      // Directly check if the event checkout_type is 'same_day'
      const aIsSameDay = a.event?.checkout_type === 'same_day';
      const bIsSameDay = b.event?.checkout_type === 'same_day';
      
      // Same-day checkouts first
      if (aIsSameDay && !bIsSameDay) return -1;
      if (!aIsSameDay && bIsSameDay) return 1;
      
      // If both are same type, sort by listing name
      const aListingName = a.event?.listing_name || '';
      const bListingName = b.event?.listing_name || '';
      return aListingName.localeCompare(bListingName);
    });
  };

  // Get a descriptive status for the assignment
  const getAssignmentStatus = (assignment: CleanerAssignmentWithEvent) => {
    if (!assignment.event) {
      return { 
        text: 'CLEANING', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-500' 
      };
    }
    
    // Check if checkout_type is 'same_day'
    if (assignment.event.checkout_type === 'same_day') {
      return { 
        text: 'SAME DAY', 
        color: 'text-purple-600', 
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-500' 
      };
    }
    
    // Otherwise it's an open checkout
    return { 
      text: 'OPEN', 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500' 
    };
  };

  // Function to format checkout time to simplified 12-hour format
  const formatCheckoutTime = (checkoutTime?: string): string => {
    if (!checkoutTime) return '';
    
    try {
      // Parse the time (expecting format like "10:00:00")
      const [hours, minutes] = checkoutTime.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) return checkoutTime;
      
      // Convert to 12-hour format
      const period = hours >= 12 ? 'pm' : 'am';
      const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12am
      
      // Only show minutes if they're not zero
      return minutes === 0 ? 
        `${hour12}${period}` : 
        `${hour12}:${minutes.toString().padStart(2, '0')}${period}`;
    } catch (error) {
      return checkoutTime;
    }
  };

  // Weekly view card for each assignment
  const renderWeeklyAssignmentCard = (assignment: CleanerAssignmentWithEvent) => {
    const { text, color, bgColor, borderColor } = getAssignmentStatus(assignment);
    const formattedCheckoutTime = formatCheckoutTime(assignment.event?.checkout_time);
    
    return (
      <div className={`p-2 sm:p-3 my-1 rounded-md border ${borderColor} ${bgColor} flex flex-col`}>
        {/* Header: Listing name and status badge */}
        <div className="flex justify-between items-start sm:items-center mb-1 sm:mb-2">
          <div className="font-bold text-sm sm:text-base truncate pr-2 flex items-center gap-1 sm:gap-2">
            {assignment.event?.listing_name || 'Unnamed Property'}
            {assignment.is_completed && (
              <span className="text-green-600 text-sm">✓</span>
            )}
          </div>
          <div className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${color} ${bgColor} border ${borderColor} whitespace-nowrap`}>
            {text}
          </div>
        </div>
        
        {/* Details and Start Job button */}
        <div className="flex justify-between items-center mt-1">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hours */}
            <div className="text-xs sm:text-sm text-gray-600">
              {assignment.hours}h
            </div>
            
            {/* Checkout time */}
            {formattedCheckoutTime && (
              <div className="flex items-center text-xs sm:text-sm text-gray-600">
                <Clock className="h-3 w-3 mr-1" />
                {formattedCheckoutTime}
              </div>
            )}
          </div>
          
          {/* Start Job Button - Smaller to fit inside */}
          <Button
            size="sm"
            onClick={() => handleStartJob(assignment)}
            className={`${assignment.is_completed 
              ? "bg-blue-600 hover:bg-blue-700 text-white px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs min-w-0" 
              : "bg-green-600 hover:bg-green-700 text-white px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs min-w-0"
            }`}
          >
            {assignment.is_completed ? (
              <>
                <svg className="h-2.5 sm:h-3 w-2.5 sm:w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resubmit
              </>
            ) : (
              <>
                <Play className="h-2.5 sm:h-3 w-2.5 sm:w-3 mr-1" />
                Start
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  // Daily view card for each assignment
  const renderDailyAssignmentCard = (assignment: CleanerAssignmentWithEvent) => {
    const { text, color, bgColor, borderColor } = getAssignmentStatus(assignment);
    const formattedCheckoutTime = formatCheckoutTime(assignment.event?.checkout_time);
    
    return (
      <div className={`p-3 rounded-lg border ${borderColor} ${bgColor} h-full flex flex-col justify-between`}>
        {/* Listing name and status */}
        <div>
          <div className="font-medium text-base mb-1 truncate flex items-center gap-2">
            {assignment.event?.listing_name || 'Unnamed Property'}
            {assignment.is_completed && (
              <span className="text-green-600 text-sm">✓</span>
            )}
          </div>
          <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color} ${bgColor} border ${borderColor}`}>
            {text}
          </div>
        </div>
        
        {/* Hours, checkout time, and start button */}
        <div className="space-y-2 mt-2">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center">
              <span className="font-medium">{assignment.hours}h</span>
            </div>
            
            {formattedCheckoutTime && (
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>{formattedCheckoutTime}</span>
              </div>
            )}
          </div>
          
          {/* Start Job Button */}
          <Button
            size="sm"
            onClick={() => handleStartJob(assignment)}
            className={`w-full ${assignment.is_completed 
              ? "bg-blue-600 hover:bg-blue-700 text-white" 
              : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {assignment.is_completed ? (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resubmit Job
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Job
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const days = getDaysForCurrentWeek();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
          <CardTitle>Your Cleaning Schedule</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              <Button 
                variant={viewMode === 'daily' ? 'default' : 'ghost'}
                size="sm" 
                onClick={() => setViewMode('daily')}
                className="text-sm"
              >
                Daily
              </Button>
              <Button 
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                size="sm" 
                onClick={() => setViewMode('weekly')}
                className="text-sm"
              >
                Weekly
              </Button>
            </div>
            {isSyncing && (
              <div className="flex items-center text-xs text-blue-600">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </div>
            )}
          </div>
        </div>
        <CardDescription>
          You can only view assignments for the current and next week
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingData ? (
          <div className="py-10 flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : viewMode === 'weekly' ? (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
              <h3 className="text-lg font-medium">
                Week of {format(days[0], 'MMM d')} - {format(days[days.length-1], 'MMM d')}
              </h3>
              <div className="space-x-2 flex items-center">
                <div className="flex">
                  <Button
                    onClick={goToPreviousWeek}
                    className="p-1 text-sm border rounded-full hover:bg-white hover:text-black transition-colors"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={goToNextWeek}
                    className="p-1 text-sm border rounded-full hover:bg-white hover:text-black transition-colors"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={goToCurrentWeek}
                  className="px-3 py-1 text-sm border rounded bg-black text-white hover:bg-white hover:text-black transition-colors"
                >
                  Today
                </Button>
              </div>
            </div>
            
            {/* Mobile Weekly View (Vertically Stacked Days) */}
            <div className="block md:hidden border rounded-lg overflow-hidden bg-white">
              {/* Week Overview Header */}
              <div className="p-2 sm:p-3 border-b bg-gray-50 sticky top-0 z-10">
                <div className="text-sm font-medium text-center">
                  Week of {format(days[0], 'MMM d')} - {format(days[days.length-1], 'MMM d')}
                </div>
              </div>
              
              {/* Vertically Stacked Days */}
              <div className="divide-y">
                {days.map((day, index) => {
                  const dayAssignments = getAssignmentsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div 
                      key={day.toString()}
                      className={`p-3 sm:p-4 ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className="font-medium text-sm sm:text-base mb-2 sm:mb-3 flex items-center justify-between">
                        <span>{format(day, 'EEEE')}</span>
                        <span className="text-gray-500">{format(day, 'MMM d')}</span>
                      </div>
                      
                      {dayAssignments.length > 0 ? (
                        <div className="space-y-2">
                          {sortAssignmentsByPriority(dayAssignments).map(assignment => (
                            <div key={assignment.uuid}>
                              {renderWeeklyAssignmentCard(assignment)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                          <CalendarIcon className="h-6 w-6 mx-auto text-gray-300 mb-1" />
                          <p className="text-sm">No assignments</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Desktop Weekly Calendar grid */}
            <div className="hidden md:block border rounded-lg overflow-hidden bg-white">
              {/* Days of the week header */}
              <div className="grid grid-cols-7 border-b">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="py-2 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {days.map(day => {
                  const dayAssignments = getAssignmentsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={day.toString()}
                      className={`
                        min-h-[120px] p-3 border-b border-r relative
                        ${isToday ? 'bg-blue-50' : ''}
                      `}
                    >
                      <div className="text-sm">
                        <span className={`${isToday ? 'font-bold text-blue-600' : ''}`}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      
                      {dayAssignments.length > 0 ? (
                        <div className="mt-1 space-y-2">
                          {sortAssignmentsByPriority(dayAssignments).map(assignment => (
                            <div key={assignment.uuid}>
                              {renderWeeklyAssignmentCard(assignment)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-gray-400">
                          No assignments
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Daily View */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                {format(currentDate, 'EEEE, MMMM d')}
              </h3>
              <div className="space-x-2 flex items-center">
                <div className="flex">
                  <Button
                    onClick={goToPreviousDay}
                    className="p-1 text-sm border rounded-full hover:bg-white hover:text-black transition-colors"
                    aria-label="Previous day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={goToNextDay}
                    className="p-1 text-sm border rounded-full hover:bg-white hover:text-black transition-colors"
                    aria-label="Next day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-sm font-medium bg-black text-white border border-black rounded hover:bg-white hover:text-black transition-colors"
                >
                  Today
                </Button>
              </div>
            </div>
            
            <div className="border rounded-lg overflow-hidden bg-white p-4">
              <div className="font-medium text-sm mb-3">
                {isSameDay(currentDate, new Date()) ? "Today's Assignments" : `Assignments for ${format(currentDate, 'MMM d')}`}
              </div>
              
              {getAssignmentsForDay(currentDate).length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {sortAssignmentsByPriority(getAssignmentsForDay(currentDate)).map(assignment => (
                    <div key={assignment.uuid}>
                      {renderDailyAssignmentCard(assignment)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <CalendarIcon className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                  <p>No assignments scheduled for this day</p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
      
      {/* Cleaning Checklist Form */}
      {selectedAssignment && (
        <CleaningChecklistForm
          isOpen={isCleaningFormOpen}
          onClose={handleCloseCleaningForm}
          assignment={selectedAssignment}
        />
      )}
    </Card>
  );
} 