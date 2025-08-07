'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle, Eye, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { JobCompletionReport, formatDuration, getChecklistCompletionPercentage } from '@/lib/cleaner-reports';
import { getCleaners, Cleaner } from '@/lib/models';
import EnhancedStatistics from './enhanced-stats';

interface CleanerReportsPageProps {}

export default function CleanerReportsPage({}: CleanerReportsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <CleanerReportsPageContent />
    </div>
  );
}

function CleanerReportsPageContent() {
  const [reports, setReports] = useState<JobCompletionReport[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentViewingWeek, setCurrentViewingWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Helper function to safely parse completion dates
  const parseCompletionDate = (completionDate: string): Date | null => {
    try {
      if (!completionDate) return null;
      
      let reportDate;
      if (completionDate.includes('T')) {
        // ISO format with time
        reportDate = new Date(completionDate);
      } else if (completionDate.includes('/')) {
        // DD/MM/YYYY format
        const [day, month, year] = completionDate.split('/').map(Number);
        reportDate = new Date(year, month - 1, day);
      } else {
        // YYYY-MM-DD format
        reportDate = new Date(completionDate + 'T00:00:00');
      }
      
      // Validate date
      if (isNaN(reportDate.getTime())) {
        console.warn('Invalid completion_date:', completionDate);
        return null;
      }
      
      // Normalize to start of day in local timezone
      reportDate.setHours(0, 0, 0, 0);
      return reportDate;
    } catch (error) {
      console.warn('Error parsing completion_date:', completionDate, error);
      return null;
    }
  };

  // Helper functions from payment reports
  function getWeekBoundaries(date: Date) {
    // Clone the date to avoid modifying the original
    const day = new Date(date);
    day.setHours(0, 0, 0, 0); // Normalize time to start of day
    
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
  }

  // Format a date range for display (same as payment reports)
  function formatWeekRange(startDate: string) {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0); // Normalize time to start of day
    const { monday, sunday } = getWeekBoundaries(date);
    
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${monday.toLocaleDateString(undefined, options)} - ${sunday.toLocaleDateString(undefined, options)}`;
  };

  // Format date for input field (YYYY-MM-DD) - same as payment reports
  function formatDateForInput(date: Date) {
    return format(date, 'yyyy-MM-dd');
  }

  // Initialize with current week
  useEffect(() => {
    const today = new Date();
    const { monday } = getWeekBoundaries(today);
    const currentWeekStr = formatDateForInput(monday);
    setCurrentViewingWeek(currentWeekStr);
  }, []);

  // Load cleaners
  useEffect(() => {
    const loadCleaners = async () => {
      try {
        const cleanersData = await getCleaners();
        setCleaners(cleanersData);
      } catch (error) {
        console.error('Error loading cleaners:', error);
        toast.error('Failed to load cleaners');
      }
    };

    loadCleaners();
  }, []);

  // Load reports - Load ALL reports like payment reports does, then filter on frontend
  const loadReports = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedCleanerId !== 'all') {
        queryParams.set('cleaner_uuid', selectedCleanerId);
      }
      if (searchTerm.trim()) {
        queryParams.set('listing_name', searchTerm.trim());
      }
      queryParams.set('limit', '1000'); // Get ALL reports for week navigation, like payment reports

      const response = await fetch(`/api/cleaner-reports?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        const reportsList = data.reports as JobCompletionReport[];
        setReports(reportsList);
        setStats(data.stats);
        
        // Extract available weeks from reports
        const weekStartDates = reportsList.map(report => {
          const reportDate = parseCompletionDate(report.completion_date);
          if (!reportDate) return null;
          
          const { monday } = getWeekBoundaries(reportDate);
          return formatDateForInput(monday);
        }).filter((week): week is string => week !== null); // Remove null values with type guard
        
        const weeks = [...new Set(weekStartDates)];
        weeks.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Most recent first
        setAvailableWeeks(weeks);
        
        // If currentViewingWeek is not set or not in available weeks, set to most recent week
        if (!currentViewingWeek || !weeks.includes(currentViewingWeek)) {
          if (weeks.length > 0) {
            setCurrentViewingWeek(weeks[0]);
          } else {
            // If no reports exist, keep the current week that was set in useEffect
            const today = new Date();
            const { monday } = getWeekBoundaries(today);
            const currentWeekStr = formatDateForInput(monday);
            setCurrentViewingWeek(currentWeekStr);
          }
        }
      } else {
        toast.error('Failed to load reports: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  // Load reports when filters change
  useEffect(() => {
    loadReports();
  }, [selectedCleanerId, searchTerm]);

  // Filter reports for current viewing week, or show all if no weeks available
  const currentWeekReports = availableWeeks.length > 0 ? reports.filter(report => {
    const reportDate = parseCompletionDate(report.completion_date);
    if (!reportDate) return false;
    
    // Get week boundaries for the report date
    const { monday: reportMonday, sunday: reportSunday } = getWeekBoundaries(reportDate);
    
    // Get week boundaries for the current viewing week
    const currentWeekDate = new Date(currentViewingWeek);
    const { monday: currentMonday, sunday: currentSunday } = getWeekBoundaries(currentWeekDate);
    
    // Check if report date falls within the current week boundaries
    return reportDate >= currentMonday && reportDate <= currentSunday;
  }) : reports;

  // Group reports by cleaner for better organization
  const reportsByCleaners = currentWeekReports.reduce((acc, report) => {
    const cleanerName = report.cleaner?.name || 'Unknown Cleaner';
    const cleanerId = report.cleaner?.id || 'unknown';
    
    if (!acc[cleanerId]) {
      acc[cleanerId] = {
        cleanerName,
        cleanerId,
        reports: []
      };
    }
    acc[cleanerId].reports.push(report);
    return acc;
  }, {} as Record<string, { cleanerName: string; cleanerId: string; reports: JobCompletionReport[] }>);

  // Convert to array and sort by cleaner name
  const cleanerGroups = Object.values(reportsByCleaners).sort((a, b) => 
    a.cleanerName.localeCompare(b.cleanerName)
  );

  // Week navigation functions
  const goToPreviousWeek = () => {
    const currentIndex = availableWeeks.indexOf(currentViewingWeek);
    if (currentIndex < availableWeeks.length - 1) {
      setCurrentViewingWeek(availableWeeks[currentIndex + 1]);
    }
  };

  const goToNextWeek = () => {
    const currentIndex = availableWeeks.indexOf(currentViewingWeek);
    if (currentIndex > 0) {
      setCurrentViewingWeek(availableWeeks[currentIndex - 1]);
    }
  };

  const goToCurrentWeek = () => {
    if (availableWeeks.length > 0) {
      setCurrentViewingWeek(availableWeeks[0]);
    }
  };

  // Export reports as CSV
  const exportReports = () => {
    if (currentWeekReports.length === 0) {
      toast.error('No reports to export');
      return;
    }

    const csvHeaders = [
      'Date',
      'Cleaner',
      'Listing',
      'Duration',
      'Rating',
      'Damage',
      'Checklist %',
      'Missing Items'
    ].join(',');

    const csvRows = currentWeekReports.map(report => [
      report.completion_date,
      report.cleaner?.name || 'Unknown',
      `"${report.listing_name}"`,
      formatDuration(report.duration_seconds),
      report.cleanliness_rating,
      report.damage_question,
      `${getChecklistCompletionPercentage(report.checklist_items)}%`,
      `"${report.missing_items_details || 'N/A'}"`
    ].join(','));

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaner-reports-${currentViewingWeek}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cleaner Reports</h1>
            <p className="mt-2 text-sm text-gray-700">
              Job completion reports and evidence for quality assurance
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_jobs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                    <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.average_duration)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>



            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Damage Reports</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.damage_reports}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cleaner-select">Cleaner</Label>
                <Select value={selectedCleanerId} onValueChange={setSelectedCleanerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cleaner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners</SelectItem>
                    {cleaners.map((cleaner) => (
                      <SelectItem key={cleaner.id} value={cleaner.id}>
                        {cleaner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="search">Search Listing</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search by listing name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={exportReports}
                  disabled={currentWeekReports.length === 0}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Week Navigation */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-medium">
            {currentViewingWeek ? `Week of ${formatWeekRange(currentViewingWeek)}` : 'Job Completion Reports'}
          </h2>
          {availableWeeks.length > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                disabled={availableWeeks.indexOf(currentViewingWeek) === availableWeeks.length - 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentWeek}
                disabled={availableWeeks.indexOf(currentViewingWeek) === 0}
              >
                Current
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                disabled={availableWeeks.indexOf(currentViewingWeek) === 0}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Enhanced Statistics */}
        <EnhancedStatistics />

        {/* Reports by Cleaner */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="bg-white shadow rounded-lg p-8">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2 text-gray-600">Loading reports...</span>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12">
              <div className="flex flex-col items-center text-center">
                <Calendar className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Job Completion Reports</h3>
                <p className="text-gray-500 max-w-md">
                  No cleaners have completed any jobs with the cleaning checklist form yet. 
                  Once cleaners start submitting job completions, they will appear here organized by cleaner.
                </p>
              </div>
            </div>
          ) : currentWeekReports.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8">
              <div className="flex flex-col items-center text-center">
                <Clock className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reports for this period</h3>
                <p className="text-gray-500">
                  No job completion reports found for the selected week and filters.
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Try selecting a different week or changing your filters.
                </p>
              </div>
            </div>
          ) : (
            cleanerGroups.map((cleanerGroup) => (
              <div key={cleanerGroup.cleanerId} className="bg-white shadow rounded-lg overflow-hidden">
                {/* Cleaner Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{cleanerGroup.cleanerName}</h3>
                      <p className="text-sm text-gray-600">
                        {cleanerGroup.reports.length} job completion{cleanerGroup.reports.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>
                        Total Duration: <span className="font-medium">
                          {formatDuration(cleanerGroup.reports.reduce((sum, r) => sum + (r.duration_seconds || 0), 0))}
                        </span>
                      </span>
                      
                    </div>
                  </div>
                </div>

                {/* Reports Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Damage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Checklist</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cleanerGroup.reports.map((report) => (
                        <tr key={report.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(() => {
                              const reportDate = parseCompletionDate(report.completion_date);
                              return reportDate ? format(reportDate, 'MMM d, yyyy') : report.completion_date;
                            })()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {report.listing_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 text-gray-400 mr-1" />
                              {formatDuration(report.duration_seconds)}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge
                              variant={report.damage_question === 'Yes' ? 'destructive' : 
                                     report.damage_question === 'Maybe' ? 'secondary' : 'default'}
                              className="font-medium"
                            >
                              {report.damage_question === 'Yes' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {report.damage_question}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-green-600 h-2 rounded-full" 
                                  style={{width: `${getChecklistCompletionPercentage(report.checklist_items)}%`}}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-gray-900">
                                {getChecklistCompletionPercentage(report.checklist_items)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/dashboard/cleaner-reports/${report.id}`}>
                              <Button size="sm" variant="outline" className="hover:bg-blue-50">
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 