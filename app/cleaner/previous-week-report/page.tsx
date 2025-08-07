'use client';

import { useState, useEffect } from 'react';
import { format, subWeeks } from 'date-fns';
import { toast } from 'sonner';
import { useCleanerAuth, CleanerProtectedRoute } from '@/lib/cleaner-auth';
import { PaymentReport } from '@/lib/payment-reports';
import CleanerExtraInfoForm from '@/components/cleaner-extra-info-form';

// Helper function to calculate Monday-Sunday boundaries for any date
function getWeekBoundaries(date: Date) {
  const day = new Date(date);
  const dayOfWeek = day.getDay();
  
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(day);
  monday.setDate(day.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
}

// Format a date range for display
function formatWeekRange(startDate: Date) {
  const { monday, sunday } = getWeekBoundaries(startDate);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString(undefined, options)} - ${sunday.toLocaleDateString(undefined, options)}`;
}

export default function PreviousWeekReportPage() {
  return (
    <CleanerProtectedRoute>
      <PreviousWeekReportContent />
    </CleanerProtectedRoute>
  );
}

function PreviousWeekReportContent() {
  const { cleaner, isLoading: authLoading } = useCleanerAuth();
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the previous week's payment report for this cleaner
  const loadPaymentReport = async () => {
    if (!cleaner) return;
    
    setIsLoading(true);
    try {
      // Get previous week boundaries
      const previousWeekDate = subWeeks(new Date(), 1);
      const { monday } = getWeekBoundaries(previousWeekDate);
      const weekStartStr = format(monday, 'yyyy-MM-dd');

      // Search for existing payment report for this cleaner and previous week
      const response = await fetch(`/api/payment-reports?cleaner_uuid=${cleaner.uuid}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        // Find report for previous week
        const previousWeekReport = data.reports.find((r: PaymentReport) => r.week_start === weekStartStr);
        setReport(previousWeekReport || null);
      } else {
        console.error('Failed to load payment reports:', data.error);
      }
    } catch (error) {
      console.error('Error loading payment report:', error);
      toast.error('Failed to load payment report');
    } finally {
      setIsLoading(false);
    }
  };

  // Load report when cleaner is available
  useEffect(() => {
    if (cleaner) {
      loadPaymentReport();
    }
  }, [cleaner]);

  if (authLoading || !cleaner) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Get previous week info for the extra info form
  const previousWeekDate = subWeeks(new Date(), 1);
  const previousWeekBoundaries = getWeekBoundaries(previousWeekDate);
  const previousWeekStart = format(previousWeekBoundaries.monday, 'yyyy-MM-dd');
  const previousWeekDisplay = formatWeekRange(previousWeekDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6 lg:space-y-8">
            {/* Header */}
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Previous Week Payment Report</h1>
              <p className="mt-2 text-sm text-gray-700">
                View and edit your previous week's payment report and earnings
              </p>
            </div>

            {/* Previous Week Section */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
                <h2 className="text-lg font-medium text-gray-900 text-center sm:text-left">
                  Previous Week ({formatWeekRange(previousWeekDate)})
                </h2>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
                </div>
              ) : report ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-sm font-medium text-blue-600">Total Hours</p>
                      <p className="text-2xl font-bold text-blue-900">{report.total_hours}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-sm font-medium text-green-600">Total Earnings</p>
                      <p className="text-2xl font-bold text-green-900">£{report.total_amount.toFixed(2)}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <p className="text-sm font-medium text-purple-600">Properties</p>
                      <p className="text-2xl font-bold text-purple-900">{report.report_data?.summary?.total_properties || 0}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                      <p className="text-sm font-medium text-orange-600">Assignments</p>
                      <p className="text-2xl font-bold text-orange-900">{report.report_data?.summary?.total_assignments || 0}</p>
                    </div>
                  </div>

                  {/* Cleaner Details */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium text-gray-900 mb-3 text-center sm:text-left">Your Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-gray-500">Name</p>
                        <p className="text-sm text-gray-900">{cleaner.name}</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-sm font-medium text-gray-500">Hourly Rate</p>
                        <p className="text-sm text-gray-900">£{report.base_rate.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Assignments */}
                  {report.report_data?.assignments && report.report_data.assignments.length > 0 && (
                    <div className="bg-white border rounded-lg overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b">
                        <h3 className="text-lg font-medium text-gray-900 text-center sm:text-left">Detailed Assignments</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Property
                              </th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Hours
                              </th>
                              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {report.report_data.assignments.map((assignment) => {
                              // Safely handle the date
                              const formatDate = (dateString: string | null | undefined) => {
                                if (!dateString) return 'No date';
                                try {
                                  const date = new Date(dateString);
                                  if (isNaN(date.getTime())) return 'Invalid date';
                                  return format(date, 'MMM d, yyyy');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              };

                              return (
                                <tr key={assignment.uuid} className="hover:bg-gray-50">
                                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {formatDate(assignment.checkout_date)}
                                  </td>
                                  <td className="px-3 sm:px-6 py-4 text-sm text-gray-900">
                                    <div className="truncate max-w-[120px] sm:max-w-none" title={assignment.listing_name}>
                                      {assignment.listing_name}
                                    </div>
                                  </td>
                                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {assignment.hours}
                                  </td>
                                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    £{assignment.amount.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Report Available</h3>
                  <p className="text-gray-600 mb-4 px-4">
                    No payment report has been generated for last week yet.
                  </p>
                </div>
              )}
            </div>

            {/* Extra Info Form Section for Previous Week */}
            {cleaner.uuid && (
              <CleanerExtraInfoForm
                cleanerUuid={cleaner.uuid}
                weekStartDate={previousWeekStart}
                weekDisplayName={previousWeekDisplay}
                onSubmitSuccess={(report) => {
                  // Reload the report to show updated data
                  loadPaymentReport();
                  console.log('Extra info submitted successfully for previous week:', report);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 