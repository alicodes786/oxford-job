'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Plus, Edit, Save, Trash, Clock, User, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Cleaner, createCleaner, getCleaners, updateCleaner, getListings } from '@/lib/models';
import { CleanerEventAssignment, getCleanerAssignments } from '@/lib/calendar-models';
import { deleteCleaner as deleteCleanerApi } from '@/lib/models';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getListingGroupName } from '@/lib/utils';

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
  event_type: string;
  is_active: boolean;
}

// Extend the CleanerEventAssignment interface to include the event
interface CleanerAssignmentWithEvent extends CleanerEventAssignment {
  event?: Event;
}

function CleanersPageContent() {
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [assignments, setAssignments] = useState<CleanerAssignmentWithEvent[]>([]);
  const [cleanerUsage, setCleanerUsage] = useState<Record<string, number>>({});
  const [newCleanerName, setNewCleanerName] = useState('');
  const [newCleanerRate, setNewCleanerRate] = useState(12.50);
  const [newCleanerPassword, setNewCleanerPassword] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState<Cleaner | null>(null);
  const [editingCleaner, setEditingCleaner] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRate, setEditRate] = useState(12.50);
  const [editPassword, setEditPassword] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cleanerToDelete, setCleanerToDelete] = useState<string | null>(null);
  const [selectedCleanerDetails, setSelectedCleanerDetails] = useState<{
    assignments: CleanerAssignmentWithEvent[];
    weeklyUsage: Record<string, number>;
  } | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [listingsByName, setListingsByName] = useState<Record<string, any>>({});
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});
  const [collapsedListings, setCollapsedListings] = useState<Record<string, boolean>>({});

  // Load cleaners from Supabase when component mounts
  useEffect(() => {
    setIsClient(true);
    loadData();
    
    // Add event listeners for page focus and click
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing data');
        refreshData();
      }
    };
    
    const handleWindowFocus = () => {
      console.log('Window focused, refreshing data');
      refreshData();
    };
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    
    // Click event on document body to refresh data
    const bodyElement = document.body;
    const handleBodyClick = () => {
      // Only refresh if it's been more than 10 seconds since last refresh
      const now = new Date();
      if (now.getTime() - lastRefresh.getTime() > 10000) {
        console.log('Page clicked, refreshing data');
        refreshData();
      }
    };
    
    if (bodyElement) {
      bodyElement.addEventListener('click', handleBodyClick);
    }
    
    // Clean up event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (bodyElement) {
        bodyElement.removeEventListener('click', handleBodyClick);
      }
    };
  }, [lastRefresh]);

  // Load cleaners and assignments from Supabase
  const loadData = async () => {
    try {
      // Load cleaners
      const cleanersData = await getCleaners();
      setCleaners(cleanersData);
      
      // Load all assignments
      const assignmentsData = await getCleanerAssignments() as CleanerAssignmentWithEvent[];
      
      // Update assignment hours based on listing_hours from event
      const updatedAssignments = assignmentsData.map(assignment => {
        if (assignment.event?.listing_hours) {
          const hours = parseFloat(assignment.event.listing_hours) || assignment.hours;
          return {
            ...assignment,
            hours: hours
          };
        }
        return assignment;
      });
      
      setAssignments(updatedAssignments);
      
      // Initialize all listings as collapsed
      const initialCollapsedState: Record<string, boolean> = {};
      updatedAssignments.forEach(assignment => {
        if (assignment.event) {
          const listingName = assignment.event.listing_name || 'Unknown';
          const parts = listingName.split('.');
          const baseName = parts[0];
          const weekStart = new Date(assignment.event.checkout_date);
          const weekKey = weekStart.toISOString().split('T')[0];
          const listingKey = `week-${weekKey}-${baseName}`;
          initialCollapsedState[listingKey] = true;
        }
      });
      setCollapsedListings(initialCollapsedState);
      
      // Load listings to get the hours and names by ID
      try {
        const listings = await getListings();
        const listingsById: Record<string, any> = {};
        
        // Index listings by ID
        listings.forEach(listing => {
          listingsById[listing.id] = {
            name: listing.name,
            hours: listing.hours || 2.0,
            color: listing.color
          };
        });
        
        setListingsByName(listingsById);
        console.log('Loaded listings by ID:', listingsById);
      } catch (error) {
        console.error('Error loading listings:', error);
      }
      
      // Load usage data for each cleaner
      const usageData: Record<string, number> = {};
      for (const cleaner of cleanersData) {
        usageData[cleaner.id] = await calculateAssignedHours(cleaner.id);
      }
      setCleanerUsage(usageData);
      
      console.log('Cleaner usage data loaded:', usageData);
    } catch (error) {
      console.error('Error loading data:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  };

  // Function to refresh the cleaner usage data
  const refreshCleanerUsage = async () => {
    try {
      // Load usage data for each cleaner
      const usageData: Record<string, number> = {};
      for (const cleaner of cleaners) {
        usageData[cleaner.id] = await calculateAssignedHours(cleaner.id);
      }
      setCleanerUsage(usageData);
    } catch (error) {
      console.error('Error refreshing cleaner usage:', error);
    }
  };

  // Add a new cleaner
  const addCleaner = async () => {
    if (!newCleanerName) {
      toast.error('Please enter a cleaner name');
      return;
    }

    setIsLoading(true);
    try {
      // Create new cleaner in Supabase
      const newCleaner = await createCleaner({
        name: newCleanerName,
        hourly_rate: newCleanerRate,
        password: newCleanerPassword,
        external_id: `cleaner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        is_active: true
      });
      
      // Update local state
      const updatedCleaners = [...cleaners, newCleaner];
      setCleaners(updatedCleaners);
      
      // Set initial usage data for the new cleaner
      setCleanerUsage(prev => ({
        ...prev,
        [newCleaner.id]: 0
      }));
      
      // Reset form
      setNewCleanerName('');
      setNewCleanerRate(12.50);
      setNewCleanerPassword('');
      
      toast.success(`Cleaner "${newCleanerName}" added successfully`);
    } catch (error) {
      console.error('Error adding cleaner:', error);
      toast.error('Failed to add cleaner');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete a cleaner
  const confirmDelete = (id: string) => {
    setCleanerToDelete(id);
  };
  
  const deleteCleaner = async () => {
    if (!cleanerToDelete) return;
    
    setIsLoading(true);
    try {
      await deleteCleanerApi(cleanerToDelete);
      
      // Update local state
      const updatedCleaners = cleaners.filter(cleaner => cleaner.id !== cleanerToDelete);
      setCleaners(updatedCleaners);
      
      if (selectedCleaner?.id === cleanerToDelete) {
        setSelectedCleaner(null);
      }
      
      toast.success('Cleaner removed');
    } catch (error) {
      console.error('Error deleting cleaner:', error);
      toast.error('Failed to delete cleaner');
    } finally {
      setCleanerToDelete(null);
      setIsLoading(false);
    }
  };

  // Start editing a cleaner
  const startEditing = (cleaner: Cleaner) => {
    setEditingCleaner(cleaner.id);
    setEditName(cleaner.name);
    setEditRate(cleaner.hourly_rate);
    setEditPassword(cleaner.password || '');
  };

  // Save edits
  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      // Update cleaner in Supabase
      const updates: Partial<Omit<Cleaner, 'id' | 'created_at' | 'updated_at'>> = {
        name: editName,
        hourly_rate: editRate
      };
      
      // Only update password if it has changed
      if (editPassword !== (cleaners.find(c => c.id === id)?.password || '')) {
        updates.password = editPassword;
      }
      
      const updatedCleaner = await updateCleaner(id, updates);
      
      // Update local state
      const updatedCleaners = cleaners.map(cleaner => 
        cleaner.id === id ? updatedCleaner : cleaner
      );
      
      setCleaners(updatedCleaners);
      setEditingCleaner(null);
      
      // Update selected cleaner if it was edited
      if (selectedCleaner?.id === id) {
        setSelectedCleaner(updatedCleaner);
        loadCleanerDetails(id); // Reload the details
      }
      
      toast.success('Cleaner updated');
    } catch (error) {
      console.error('Error updating cleaner:', error);
      toast.error('Failed to update cleaner');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate Monday-Sunday boundaries for any date
  const getWeekBoundaries = (date: Date) => {
    // Clone the date to avoid modifying the original
    const day = new Date(date);
    const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday (first day of week)
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If today is Sunday, Monday was 6 days ago
    const monday = new Date(day);
    monday.setDate(day.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    // Calculate Sunday (last day of week) - EXACTLY 6 days after Monday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { monday, sunday };
  };

  // Helper function to get listing name from id
  const getListingName = (listingId: string): string => {
    return listingsByName[listingId]?.name || 'Unknown Listing';
  };
  
  // Helper function to get hours for a listing
  const getHoursForListing = (listingId: string): number => {
    return listingsByName[listingId]?.hours || 2.0;
  };

  // Group assignments by week (Monday-Sunday)
  const groupAssignmentsByWeek = (cleanerId: string, cleanerAssignments?: CleanerAssignmentWithEvent[]) => {
    // If cleanerAssignments is not provided, use the ones from assignments state filtered by cleaner id
    const assignmentsToUse = cleanerAssignments || 
      assignments.filter(assignment => assignment.cleaner_uuid === cleanerId);
    
    // Use a map with timestamp keys to preserve the original Date object
    const weeks: { [key: number]: { monday: Date, assignments: CleanerAssignmentWithEvent[] } } = {};
    
    assignmentsToUse.forEach(assignment => {
      // Find the corresponding event to get the checkout date
      const event = assignment.event; // This should be joined in the getCleanerAssignments function
      if (!event) return;
      
      // Use the checkout date from the associated event as assignment date
      const date = new Date(event.checkout_date);
      
      // Find the Monday of this week using the helper function
      const { monday: mondayDate } = getWeekBoundaries(date);
      const weekKey = mondayDate.getTime(); // Use timestamp as key
      if (!weeks[weekKey]) {
        weeks[weekKey] = { monday: mondayDate, assignments: [] };
      }
      weeks[weekKey].assignments.push(assignment);
    });
    
    return Object.values(weeks)
      .map(({ monday, assignments }) => ({
        weekStart: monday,
        assignments
      }))
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime()); // Reverse sort - most recent weeks first
  };

  // Load details for a specific cleaner 
  const loadCleanerDetails = async (cleanerId: string) => {
    try {
      const cleanerAssignments = await getCleanerAssignments(cleanerId) as CleanerAssignmentWithEvent[];
      
      // Update hours based on listing_hours from event
      const updatedAssignments = cleanerAssignments.map(assignment => {
        if (assignment.event?.listing_hours) {
          const hours = parseFloat(assignment.event.listing_hours) || assignment.hours;
          return {
            ...assignment,
            hours: hours
          };
        }
        return assignment;
      });
      
      // Group assignments by week
      const groupedAssignments = groupAssignmentsByWeek(cleanerId, updatedAssignments);
      
      // Calculate usage for each week
      const weeklyUsage: Record<string, number> = {};
      for (const group of groupedAssignments) {
        const weekKey = group.weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
        weeklyUsage[weekKey] = group.assignments.reduce((total, a) => total + a.hours, 0);
      }
      
      setSelectedCleanerDetails({
        assignments: updatedAssignments,
        weeklyUsage
      });
      
    } catch (error) {
      console.error('Error loading cleaner details:', error);
      toast.error('Failed to load cleaner details');
    }
  };

  // Effect to load cleaner details when selected cleaner changes
  useEffect(() => {
    if (selectedCleaner) {
      loadCleanerDetails(selectedCleaner.id);
    } else {
      setSelectedCleanerDetails(null);
    }
  }, [selectedCleaner]);

  // Combined function to refresh all data
  const refreshData = async () => {
    if (isLoading) return;
    
    console.log('Refreshing cleaner data');
    setIsLoading(true);
    
    try {
      toast.loading('Refreshing data...', { id: 'refresh-data' });
      await loadData();
      if (selectedCleaner) {
        await loadCleanerDetails(selectedCleaner.id);
      }
      setLastRefresh(new Date());
      toast.success('Data refreshed successfully', { id: 'refresh-data' });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data', { id: 'refresh-data' });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate total hours for a cleaner in the current week
  const calculateAssignedHours = async (cleanerId: string) => {
    try {
      // Get all assignments for this cleaner
      const cleanerAssignments = await getCleanerAssignments(cleanerId) as CleanerAssignmentWithEvent[];
      
      // Update hours based on listing_hours from event
      const updatedAssignments = cleanerAssignments.map(assignment => {
        if (assignment.event?.listing_hours) {
          const hours = parseFloat(assignment.event.listing_hours) || assignment.hours;
          return {
            ...assignment,
            hours: hours
          };
        }
        return assignment;
      });
      
      // Calculate hours for current week
      const totalHours = updatedAssignments.reduce((total, assignment) => {
        // Use the event's checkout_date as the assignment date
        const assignmentDate = assignment.event ? new Date(assignment.event.checkout_date) : null;
        if (assignmentDate && isCurrentWeek(assignmentDate)) {
          return total + assignment.hours;
        }
        return total;
      }, 0);
      
      return totalHours;
    } catch (error) {
      console.error('Error calculating assigned hours:', error);
      return 0; // Return 0 as fallback in case of error
    }
  };

  // Check if a date is in the current week
  const isCurrentWeek = (date: Date) => {
    const today = new Date();
    
    // Get the Monday of the week for the input date
    // The input 'date' here is the weekStart, which is derived from 'YYYY-MM-DD' 
    // and represents Monday 00:00 UTC. getWeekBoundaries handles this correctly
    // and returns the corresponding Monday at 00:00 local time.
    const { monday: inputWeekMonday } = getWeekBoundaries(date);
    
    // Get the Monday of the week for today (local time)
    const { monday: currentWeekMonday } = getWeekBoundaries(today);
    
    // Compare if they represent the same calendar day (Year, Month, Date)
    const isSameDay = inputWeekMonday.getFullYear() === currentWeekMonday.getFullYear() &&
                      inputWeekMonday.getMonth() === currentWeekMonday.getMonth() &&
                      inputWeekMonday.getDate() === currentWeekMonday.getDate();
                      
    return isSameDay;
  };

  // Format a date range for display
  const formatWeekRange = (startDate: Date) => {
    const { monday, sunday } = getWeekBoundaries(startDate);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${monday.toLocaleDateString(undefined, options)} - ${sunday.toLocaleDateString(undefined, options)}`;
  };

  // Update the toggle function
  const toggleListingCollapse = (listingKey: string) => {
    setCollapsedListings(prev => ({
      ...prev,
      [listingKey]: prev[listingKey] === false ? true : false // Toggle between true/false, defaulting to false to expand
    }));
  };

  if (!isClient) {
    return null;
  }

  return (
    <div className="p-6">
      {/* Deletion confirmation dialog */}
      <AlertDialog open={!!cleanerToDelete} onOpenChange={(open) => !open && setCleanerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this cleaner and remove all their assignments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCleaner} className="bg-red-500 hover:bg-red-600 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cleaners</h1>
            <p className="text-muted-foreground">
              View cleaner assignments and hours.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Usage Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cleaners List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Your Cleaners</CardTitle>
              <CardDescription>
                Click on a cleaner to view their assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cleaners.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No cleaners found.
                  </p>
                ) : (
                  cleaners.map(cleaner => (
                    <div 
                      key={cleaner.id}
                      className={`
                        border rounded-md p-3 cursor-pointer
                        ${selectedCleaner?.id === cleaner.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}
                      `}
                      onClick={() => setSelectedCleaner(cleaner)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{cleaner.name}</h3>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            <span>
                              £{cleaner.hourly_rate.toFixed(2)}/hour
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cleaner Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedCleaner ? selectedCleaner.name : 'Cleaner Details'}
              </CardTitle>
              <CardDescription>
                {selectedCleaner 
                  ? `Hourly rate: £${selectedCleaner.hourly_rate.toFixed(2)}` 
                  : 'Select a cleaner to view their assignments'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedCleaner ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <User className="h-12 w-12 text-gray-300 mb-3" />
                  <h3 className="font-medium">No Cleaner Selected</h3>
                  <p className="max-w-md mt-1">
                    Select a cleaner from the list to view their weekly assignments and hours.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Assignments by Week</h3>
                  </div>
                  
                  {selectedCleanerDetails?.assignments.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
                      <Clock className="h-12 w-12 text-gray-300 mb-3" />
                      <h3 className="font-medium">No Assignments Yet</h3>
                      <p className="max-w-md mt-1">
                        This cleaner hasn't been assigned to any cleanings yet.
                        Assign them from the Calendar cleaning view.
                      </p>
                      <Link href="/dashboard/calendar" className="mt-4">
                        <Button>Go to Calendar</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupAssignmentsByWeek(selectedCleaner.id, selectedCleanerDetails?.assignments).map((week, idx) => {
                        const weekStart = week.weekStart;
                        const weekKey = `week-${idx}-${weekStart.toISOString()}`;
                        const weekTotal = selectedCleanerDetails?.weeklyUsage[weekStart.toISOString().split('T')[0]] || 0;
                        
                        // Calculate Sunday (end of week) using the helper function
                        const { sunday: weekEnd } = getWeekBoundaries(weekStart);
                        
                        const isThisWeek = isCurrentWeek(weekStart);
                        
                        // More robust date formatting to ensure correct display
                        const formatDate = (date: Date) => {
                          // Use explicit formatting to avoid locale issues
                          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          const month = months[date.getMonth()];
                          const day = date.getDate();
                          
                          // Ensure the date is valid before formatting
                          if (isNaN(date.getTime())) {
                            return 'Invalid date';
                          }
                          
                          return `${month} ${day}`;
                        };
                        
                        // Create new date objects to avoid reference issues
                        const startDate = new Date(weekStart);
                        // Explicitly create end date as 6 days after start date
                        const endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + 6);
                        
                        // Use a consistent color for all weekly headers
                        const weekColor = 'bg-blue-100 border-blue-200';
                        
                        // Generate a unique key for this week
                        const isCollapsed = collapsedWeeks[weekKey] || false;
                        
                        // Toggle collapse handler
                        const toggleCollapse = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setCollapsedWeeks(prev => ({
                            ...prev,
                            [weekKey]: !prev[weekKey]
                          }));
                        };
                        
                        return (
                          <div key={idx} className="border border-blue-200 rounded-md overflow-hidden mb-6 shadow-sm">
                            <div 
                              className={`p-3 border-b ${weekColor} cursor-pointer`}
                              onClick={toggleCollapse}
                            >
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium flex items-center">
                                  <span className="inline-block w-5 mr-1 text-blue-600">
                                    {isCollapsed ? 
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                      </svg>
                                      : 
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                      </svg>
                                    }
                                  </span>
                                  {formatWeekRange(weekStart)}
                                </h4>
                                <div className="flex gap-2">
                                  <div className="text-sm font-semibold px-2 py-1 bg-white rounded-full shadow-sm">
                                    <span className="font-medium">
                                      {weekTotal}
                                    </span> hours
                                  </div>
                                  <div className="text-sm font-semibold px-2 py-1 bg-green-50 border border-green-100 rounded-full shadow-sm">
                                    £{(weekTotal * selectedCleaner.hourly_rate).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Week content - only show if not collapsed */}
                            {!isCollapsed && (
                              <div className="p-3 space-y-6">
                                <div>
                                  {(() => {
                                    // Group assignments by base listing name
                                    const assignmentsByBase: Record<string, CleanerAssignmentWithEvent[]> = {};
                                    
                                    week.assignments.forEach(assignment => {
                                      const event = assignment.event;
                                      if (!event) return;
                                      
                                      const listingName = event.listing_name || 'Unknown';
                                      const baseName = getListingGroupName(listingName);
                                      
                                      if (!assignmentsByBase[baseName]) {
                                        assignmentsByBase[baseName] = [];
                                      }
                                      assignmentsByBase[baseName].push(assignment);
                                    });
                                    
                                    const sortedGroups = Object.keys(assignmentsByBase).sort();
                                    const groupHeaderBg = 'bg-gray-100';
                                    const groupBadgeColor = 'bg-blue-200';
                                    
                                    return sortedGroups.map((baseName, groupIndex) => {
                                      const assignments = assignmentsByBase[baseName].sort((a, b) => {
                                        const aEvent = a.event;
                                        const bEvent = b.event;
                                        if (!aEvent || !bEvent) return 0;
                                        
                                        return new Date(aEvent.checkout_date).getTime() - new Date(bEvent.checkout_date).getTime();
                                      });
                                      
                                      const hasMultipleAssignments = assignments.length > 1;
                                      const listingKey = `${weekKey}-${baseName}`;
                                      const isListingCollapsed = collapsedListings[listingKey] !== false;
                                      
                                      // Calculate total hours and amount for this listing group
                                      const listingTotalHours = assignments.reduce((total, assignment) => total + assignment.hours, 0);
                                      const listingTotalAmount = listingTotalHours * selectedCleaner.hourly_rate;
                                      
                                      return (
                                        <div 
                                          key={baseName} 
                                          className="rounded-md border border-gray-200 overflow-hidden shadow-sm mb-5 last:mb-0"
                                        >
                                          <div 
                                            className={`px-3 py-2 border-b ${groupHeaderBg} flex items-center justify-between cursor-pointer`}
                                            onClick={() => toggleListingCollapse(listingKey)}
                                          >
                                            <div className="flex items-center">
                                              <span className="inline-block w-5 mr-1 text-gray-600">
                                                {isListingCollapsed ? 
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                                  </svg>
                                                  : 
                                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                                                  </svg>
                                                }
                                              </span>
                                              <span className={`${groupBadgeColor} text-xs font-medium px-2.5 py-0.5 rounded-full`}>
                                                {baseName}
                                              </span>
                                              {hasMultipleAssignments && (
                                                <span className="text-xs ml-2 text-gray-500">
                                                  {assignments.length} listings
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                              <div className="text-sm font-semibold px-2 py-1 bg-white rounded-full shadow-sm">
                                                {listingTotalHours} hours
                                              </div>
                                              <div className="text-sm font-semibold px-2 py-1 bg-green-50 border border-green-100 rounded-full shadow-sm">
                                                £{listingTotalAmount.toFixed(2)}
                                              </div>
                                            </div>
                                          </div>
                                          {!isListingCollapsed && (
                                            <div className="divide-y divide-gray-100">
                                              {assignments.map((assignment, idx) => (
                                                <div key={idx} className="p-4 flex justify-between items-center hover:bg-gray-50">
                                                  <div>
                                                    <div className="font-medium">
                                                      {assignment.event?.listing_name || 'Unknown Property'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                      {assignment.event ? new Date(assignment.event.checkout_date).toLocaleDateString('en-US', { 
                                                        weekday: 'short',
                                                        month: 'short', 
                                                        day: 'numeric'
                                                      }) : 'Unknown Date'}
                                                    </div>
                                                  </div>
                                                  <div className="flex gap-2 items-center">
                                                    <div className="text-sm font-medium">
                                                      {assignment.hours} hours
                                                    </div>
                                                    <div className="text-sm font-medium text-green-600">
                                                      £{(assignment.hours * selectedCleaner.hourly_rate).toFixed(2)}
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CleanersPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'sub-admin']}>
      <CleanersPageContent />
    </ProtectedRoute>
  );
} 