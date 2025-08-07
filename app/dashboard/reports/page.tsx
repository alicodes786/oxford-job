'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaymentReport, PaymentReportFilters } from '@/lib/payment-reports';
import { Cleaner } from '@/lib/models';
import { getListingGroupName } from '@/lib/utils';

// Helper function to calculate Monday-Sunday boundaries for any date (same as cleaners tab)
function getWeekBoundaries(date: Date) {
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
}

// Format a date range for display (same as cleaners tab)
function formatWeekRange(startDate: Date) {
  const { monday, sunday } = getWeekBoundaries(startDate);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString(undefined, options)} - ${sunday.toLocaleDateString(undefined, options)}`;
}

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

// Parse date from input field and get the Monday of that week
function parseWeekStartFromInput(dateStr: string) {
  // Parse the date string as local date to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const inputDate = new Date(year, month - 1, day); // month is 0-indexed
  const { monday } = getWeekBoundaries(inputDate);
  return monday;
}

// Format date for backend (ensure consistent timezone)
function formatWeekStartForBackend(date: Date) {
  // Format as YYYY-MM-DD without timezone conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ReportsPageProps {}

export default function ReportsPage({}: ReportsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ReportsPageContent />
    </div>
  );
}

function ReportsPageContent() {
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>('all');
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [useCurrentWeek, setUseCurrentWeek] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<PaymentReportFilters>({
    page: 1,
    limit: 50 // Increase limit to get more reports for week navigation
  });
  const [totalReports, setTotalReports] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [duplicatesSummary, setDuplicatesSummary] = useState<any>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  // Week navigation state
  const [currentViewingWeek, setCurrentViewingWeek] = useState<string>('');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);

  // Initialize with current week
  useEffect(() => {
    const today = new Date();
    const { monday } = getWeekBoundaries(today);
    const currentWeekStr = formatDateForInput(monday);
    setSelectedWeekStart(currentWeekStr);
    setCurrentViewingWeek(currentWeekStr);
  }, []);

  // Load cleaners
  useEffect(() => {
    const loadCleaners = async () => {
      try {
        const response = await fetch('/api/cleaners');
        const data = await response.json();
        if (data.success) {
          setCleaners(data.cleaners);
        }
      } catch (error) {
        console.error('Error loading cleaners:', error);
        toast.error('Failed to load cleaners');
      }
    };

    loadCleaners();
  }, []);

  // Load reports
  const loadReports = async () => {
    setIsLoading(true);
    try {
      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (filters.cleaner_uuid) queryParams.set('cleaner_uuid', filters.cleaner_uuid);
      if (filters.page) queryParams.set('page', filters.page.toString());
      if (filters.limit) queryParams.set('limit', filters.limit.toString());

      const response = await fetch(`/api/payment-reports?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        const reportsList = data.reports as PaymentReport[];
        setReports(reportsList);
        setTotalReports(data.count);
        
        // Extract available weeks from reports
        const weekStartDates = reportsList.map(report => report.week_start);
        const weeks = [...new Set(weekStartDates)];
        weeks.sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Most recent first
        setAvailableWeeks(weeks);
        
        // If currentViewingWeek is not set or not in available weeks, set to most recent week
        if (!currentViewingWeek || !weeks.includes(currentViewingWeek)) {
          if (weeks.length > 0) {
            setCurrentViewingWeek(weeks[0]);
          }
        }
      } else {
        toast.error('Failed to load reports');
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
  }, [filters]);

  // Generate report for selected cleaner(s)
  const generateReport = async () => {
    if (!useCurrentWeek && !selectedWeekStart) {
      toast.error('Please select a week start date');
      return;
    }

    setIsGenerating(true);
    try {
      const requestBody: any = {
        cleaner_uuid: selectedCleanerId === 'all' ? null : selectedCleanerId,
      };

      if (useCurrentWeek) {
        requestBody.use_current_week = true;
      } else {
        // Parse the selected date and get the Monday of that week
        const weekStartDate = parseWeekStartFromInput(selectedWeekStart);
        requestBody.week_start = formatWeekStartForBackend(weekStartDate);
      }

      const response = await fetch('/api/payment-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        const weekDisplay = useCurrentWeek 
          ? formatWeekRange(new Date())
          : formatWeekRange(parseWeekStartFromInput(selectedWeekStart));
        
        toast.success(selectedCleanerId === 'all' 
          ? `Reports generated for all cleaners (${weekDisplay})` 
          : `Report generated successfully (${weekDisplay})`
        );
        loadReports(); // Reload the reports list
      } else {
        toast.error(data.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Check for duplicate reports
  const checkForDuplicates = async () => {
    setIsCheckingDuplicates(true);
    try {
      const response = await fetch('/api/payment-reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get-duplicates-summary'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setDuplicatesSummary(data);
        if (data.totalDuplicates === 0) {
          toast.success('No duplicate reports found');
        } else {
          toast.info(`Found ${data.totalDuplicates} duplicate reports`);
        }
      } else {
        toast.error(data.error || 'Failed to check for duplicates');
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      toast.error('Failed to check for duplicates');
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  // Clean up duplicate reports
  const cleanupDuplicates = async () => {
    if (!duplicatesSummary || duplicatesSummary.totalDuplicates === 0) {
      toast.error('No duplicates to clean up');
      return;
    }

    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/payment-reports', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cleanup-duplicates'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Successfully removed ${data.duplicatesRemoved} duplicate reports`);
        setDuplicatesSummary(null); // Reset the summary
        loadReports(); // Reload the reports list
      } else {
        toast.error(data.error || 'Failed to cleanup duplicates');
      }
    } catch (error) {
      console.error('Error cleaning up duplicates:', error);
      toast.error('Failed to cleanup duplicates');
    } finally {
      setIsCleaningUp(false);
    }
  };

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

  const goToToday = () => {
    const today = new Date();
    const { monday } = getWeekBoundaries(today);
    const currentWeekStr = formatDateForInput(monday);
    if (availableWeeks.includes(currentWeekStr)) {
      setCurrentViewingWeek(currentWeekStr);
    }
  };

  // Filter reports for current viewing week
  const currentWeekReports = reports.filter(report => report.week_start === currentViewingWeek);

  // Helper function to format extra info for display
  const formatExtraInfo = (report: PaymentReport) => {
    if (!report.extra_info || report.extra_info.length === 0) {
      return <span className="text-gray-400 text-xs">No extra info</span>;
    }

    // Sum up all extra hours
    const totalExtraHours = report.extra_info.reduce((sum, info) => sum + info.extra_hours, 0);
    const hasNotes = report.extra_info.some(info => info.notes && info.notes.trim());

    return (
      <div className="text-xs space-y-1">
        {totalExtraHours > 0 && (
          <div className="text-green-600">
            ⏱️ +{totalExtraHours}h extra
          </div>
        )}
        {hasNotes && (
          <div className="text-purple-600" title={report.extra_info.map(info => info.notes).filter(Boolean).join('\n')}>
            📝 Notes
          </div>
        )}
      </div>
    );
  };

  // Calculate total amount per bank account for the current week
  const bankAccountSummary: { [key: string]: { [key: string]: number } } = {};
  currentWeekReports.forEach(report => {
    if (report.report_data?.breakdown_by_bank_account) {
      Object.entries(report.report_data.breakdown_by_bank_account).forEach(([account, data]) => {
        if (!bankAccountSummary[account]) {
          bankAccountSummary[account] = {};
        }
        bankAccountSummary[account][report.cleaner_uuid] = data.amount || 0;
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payment Reports</h1>
            <p className="mt-2 text-sm text-gray-700">
              Generate and manage weekly payment reports for cleaners
            </p>
          </div>
          <div>
            <button
              onClick={() => window.location.href = '/dashboard/reports/historic'}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              View Historic Reports
            </button>
          </div>
        </div>

        {/* Report Generation */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Generate New Report</h2>
          <div className="space-y-4">
            {/* Week Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Week Selection</label>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="current-week"
                    name="week-selection"
                    checked={useCurrentWeek}
                    onChange={(e) => setUseCurrentWeek(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="current-week" className="ml-3 block text-sm font-medium text-gray-700">
                    Current Week ({formatWeekRange(new Date())})
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    id="custom-week"
                    name="week-selection"
                    checked={!useCurrentWeek}
                    onChange={(e) => setUseCurrentWeek(!e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <label htmlFor="custom-week" className="ml-3 block text-sm font-medium text-gray-700">
                    Custom Week
                  </label>
                </div>
              </div>
            </div>

            {/* Custom Week Date Picker */}
            {!useCurrentWeek && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select any date in the desired week
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="date"
                      value={selectedWeekStart}
                      onChange={(e) => setSelectedWeekStart(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      The report will be generated for the Monday-Sunday week containing this date
                    </p>
                  </div>
                  <div className="flex items-center">
                    {selectedWeekStart && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <strong>Week:</strong> {formatWeekRange(parseWeekStartFromInput(selectedWeekStart))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cleaner Selection and Generate Button */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cleaner selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Cleaner</label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={selectedCleanerId}
                  onChange={(e) => setSelectedCleanerId(e.target.value)}
                >
                  <option value="all">All Cleaners</option>
                  {cleaners.map(cleaner => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generate report button */}
              <div className="flex items-end">
                <button
                  onClick={generateReport}
                  disabled={isGenerating}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : `Generate ${selectedCleanerId === 'all' ? 'Reports' : 'Report'}`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cleanup Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Report Cleanup</h2>
          <p className="text-sm text-gray-600 mb-4">
            Clean up duplicate reports that may have been created accidentally.
          </p>
          
          <div className="space-y-4">
            {/* Check for duplicates */}
            <div className="flex items-center space-x-4">
              <button
                onClick={checkForDuplicates}
                disabled={isCheckingDuplicates}
                className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50"
              >
                {isCheckingDuplicates ? 'Checking...' : 'Check for Duplicates'}
              </button>
              
              {duplicatesSummary && (
                <div className="text-sm">
                  {duplicatesSummary.totalDuplicates === 0 ? (
                    <span className="text-green-600">✓ No duplicates found</span>
                  ) : (
                    <span className="text-orange-600">
                      ⚠ Found {duplicatesSummary.totalDuplicates} duplicate reports in {duplicatesSummary.duplicateGroups.length} groups
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Cleanup button */}
            {duplicatesSummary && duplicatesSummary.totalDuplicates > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={cleanupDuplicates}
                    disabled={isCleaningUp}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {isCleaningUp ? 'Cleaning Up...' : `Remove ${duplicatesSummary.totalDuplicates} Duplicates`}
                  </button>
                  <p className="text-sm text-gray-600">
                    This will keep the most recent report for each cleaner/week and delete the older ones.
                  </p>
                </div>
              </div>
            )}

            {/* Duplicate details */}
            {duplicatesSummary && duplicatesSummary.duplicateGroups.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Duplicate Groups:</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {duplicatesSummary.duplicateGroups.map((group: any, index: number) => {
                    const cleaner = cleaners.find(c => c.id === group.cleaner_uuid);
                    return (
                      <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="font-medium">
                          {cleaner?.name || 'Unknown Cleaner'} - Week {group.week_start}
                        </div>
                        <div className="text-gray-600">
                          {group.count} reports (keeping most recent, deleting {group.count - 1})
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Week Navigation Header */}
        {availableWeeks.length > 0 && (
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                Week of {currentViewingWeek ? formatWeekRange(new Date(currentViewingWeek)) : 'Loading...'}
              </h2>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPreviousWeek}
                  disabled={availableWeeks.indexOf(currentViewingWeek) >= availableWeeks.length - 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={goToToday}
                  disabled={!availableWeeks.includes(formatDateForInput(getWeekBoundaries(new Date()).monday))}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Today
                </button>
                <button
                  onClick={goToNextWeek}
                  disabled={availableWeeks.indexOf(currentViewingWeek) <= 0}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reports list */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Week
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cleaner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Extra Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : currentWeekReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                      No reports found for this week
                    </td>
                  </tr>
                ) : (
                  <>
                    {currentWeekReports.map((report) => {
                      const cleaner = cleaners.find(c => c.id === report.cleaner_uuid);
                      return (
                        <tr key={report.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatWeekRange(new Date(report.week_start))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cleaner?.name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {report.total_hours}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            £{report.total_amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {formatExtraInfo(report)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              report.status === 'paid' ? 'bg-green-100 text-green-800' :
                              report.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <button
                              onClick={() => window.location.href = `/dashboard/reports/${report.id}?from=reports`}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" colSpan={3}>
                        Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                        £{currentWeekReports.reduce((sum, report) => sum + report.total_amount, 0).toFixed(2)}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown by Listing */}
        {!isLoading && currentWeekReports.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Breakdown by Listing</h2>
            <p className="text-sm text-gray-600 mb-4">
              This shows the total hours worked and amount for each property.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hours Worked
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    // Aggregate data from all reports
                    const listingSummary: { [key: string]: { hours: number; amount: number } } = {};
                    
                    currentWeekReports.forEach(report => {
                      if (report.report_data?.breakdown_by_listing) {
                        Object.entries(report.report_data.breakdown_by_listing).forEach(([listingName, data]) => {
                          // Get the base group name for the listing
                          const groupName = getListingGroupName(listingName.replace(' (Extra Hours)', ''));
                          
                          if (!listingSummary[groupName]) {
                            listingSummary[groupName] = { hours: 0, amount: 0 };
                          }
                          listingSummary[groupName].hours += data.hours;
                          listingSummary[groupName].amount += data.amount;
                        });
                      }
                    });

                    // Sort listings by name
                    const sortedListings = Object.entries(listingSummary).sort(([a], [b]) => a.localeCompare(b));

                    // Calculate totals
                    const totalHours = Object.values(listingSummary).reduce((sum, data) => sum + data.hours, 0);
                    const totalAmount = Object.values(listingSummary).reduce((sum, data) => sum + data.amount, 0);

                    return (
                      <>
                        {sortedListings.map(([listingName, data]) => (
                          <tr key={listingName}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {listingName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {data.hours.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              £{data.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {/* Total row */}
                        <tr className="bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            Total
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {totalHours.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            £{totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Summary by Bank Account */}
        {!isLoading && currentWeekReports.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Payment Summary by Bank Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              This shows how much needs to be paid from each bank account for the properties associated with it.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bank Account
                    </th>
                    {currentWeekReports.map((report) => (
                      <th key={report.cleaner_uuid} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {cleaners.find(c => c.id === report.cleaner_uuid)?.name || 'Unknown'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(bankAccountSummary).map(([bankAccount, cleanerAmounts]) => (
                    <tr key={bankAccount}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {bankAccount}
                      </td>
                      {currentWeekReports.map((report) => (
                        <td key={report.cleaner_uuid} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {cleanerAmounts[report.cleaner_uuid] ? `£${cleanerAmounts[report.cleaner_uuid].toFixed(2)}` : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Add totals row */}
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Total per Cleaner
                    </td>
                    {currentWeekReports.map((report) => {
                      const cleanerTotal = Object.values(bankAccountSummary).reduce((sum, amounts) => {
                        return sum + (amounts[report.cleaner_uuid] || 0);
                      }, 0);
                      return (
                        <td key={report.cleaner_uuid} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          £{cleanerTotal.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get unique bank accounts from all reports
function getBankAccounts(reports: PaymentReport[]): string[] {
  const bankAccounts = new Set<string>();
  
  reports.forEach(report => {
    if (report.report_data?.breakdown_by_bank_account) {
      Object.keys(report.report_data.breakdown_by_bank_account).forEach(account => {
        bankAccounts.add(account);
      });
    }
  });

  return Array.from(bankAccounts).sort();
}

// Helper function to get amount for a specific bank account from a report
function getBankAccountAmount(report: PaymentReport, bankAccount: string): number {
  if (!report.report_data?.breakdown_by_bank_account) return 0;
  return report.report_data.breakdown_by_bank_account[bankAccount]?.amount || 0;
} 