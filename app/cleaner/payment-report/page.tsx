'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useCleanerAuth, CleanerProtectedRoute } from '@/lib/cleaner-auth';
import { PaymentReport } from '@/lib/payment-reports';
import CleanerExtraInfoForm from '@/components/cleaner-extra-info-form';

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

// Status Messages Component
function StatusMessage({ report }: { report: PaymentReport }) {
  return (
    <div className={`mb-4 p-4 rounded-lg ${
      report.status === 'approved' ? 'bg-blue-50 border border-blue-200' :
      report.status === 'paid' ? 'bg-green-50 border border-green-200' :
      report.status === 'rejected' ? 'bg-red-50 border border-red-200' :
      'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-start">
        <div className={`mr-3 ${
          report.status === 'approved' ? 'text-blue-500' :
          report.status === 'paid' ? 'text-green-500' :
          report.status === 'rejected' ? 'text-red-500' :
          'text-yellow-500'
        }`}>
          {report.status === 'approved' && (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {report.status === 'paid' && (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {report.status === 'rejected' && (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {report.status === 'pending' && (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div>
          <h3 className={`text-sm font-medium ${
            report.status === 'approved' ? 'text-blue-800' :
            report.status === 'paid' ? 'text-green-800' :
            report.status === 'rejected' ? 'text-red-800' :
            'text-yellow-800'
          }`}>
            {report.status === 'approved' && 'Payment Approved'}
            {report.status === 'paid' && 'Payment Completed'}
            {report.status === 'rejected' && 'Payment Needs Revision'}
            {report.status === 'pending' && 'Payment Pending Review'}
          </h3>
          <div className={`mt-1 text-sm ${
            report.status === 'approved' ? 'text-blue-700' :
            report.status === 'paid' ? 'text-green-700' :
            report.status === 'rejected' ? 'text-red-700' :
            'text-yellow-700'
          }`}>
            {report.status === 'approved' && (
              'Your payment report has been approved and is ready for payment.'
            )}
            {report.status === 'paid' && (
              'Your payment has been processed and should be received shortly.'
            )}
            {report.status === 'rejected' && report.rejection_message && (
              <>
                <p>Your payment report needs revision:</p>
                <p className="mt-1 font-medium">{report.rejection_message}</p>
              </>
            )}
            {report.status === 'pending' && (
              'Your payment report is being reviewed by the admin.'
            )}
          </div>
          {report.status === 'rejected' && (
            <div className="mt-3">
              <button
                onClick={() => window.location.href = '#extra-info-form'}
                className="text-sm text-red-700 hover:text-red-800 font-medium"
              >
                → Update Extra Hours
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CleanerPaymentReportPage() {
  return (
    <CleanerProtectedRoute>
      <CleanerPaymentReportContent />
    </CleanerProtectedRoute>
  );
}

function CleanerPaymentReportContent() {
  const { cleaner, isLoading: authLoading } = useCleanerAuth();
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load the current week's payment report for this cleaner
  const loadPaymentReport = async () => {
    if (!cleaner) return;
    
    setIsLoading(true);
    try {
      // Get current week boundaries
      const { monday } = getWeekBoundaries(new Date());
      const weekStartStr = format(monday, 'yyyy-MM-dd');

      // Search for existing payment report for this cleaner and week
      const response = await fetch(`/api/payment-reports?cleaner_uuid=${cleaner.uuid}&limit=50`);
      const data = await response.json();
      
      if (data.success) {
        // Find report for current week
        const currentWeekReport = data.reports.find((r: PaymentReport) => r.week_start === weekStartStr);
        setReport(currentWeekReport || null);
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

  // Get current week info for the extra info form
  const currentWeekBoundaries = getWeekBoundaries(new Date());
  const currentWeekStart = format(currentWeekBoundaries.monday, 'yyyy-MM-dd');
  const currentWeekDisplay = formatWeekRange(new Date());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6 lg:space-y-8">
            {/* Header */}
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">My Payment Report</h1>
              <p className="mt-2 text-sm text-gray-700">
                View your weekly payment report and earnings
              </p>
            </div>

            {/* Status Messages */}
            {report && <StatusMessage report={report} />}

            {/* Current Week Section */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
                <h2 className="text-lg font-medium text-gray-900 text-center sm:text-left">
                  Current Week ({formatWeekRange(new Date())})
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
                    No payment report has been generated for this week yet. Please contact your administrator to generate your payment report.
                  </p>
                </div>
              )}
            </div>

            {/* Extra Info Form Section */}
            {cleaner.uuid && (
              <CleanerExtraInfoForm
                cleanerUuid={cleaner.uuid}
                weekStartDate={currentWeekStart}
                weekDisplayName={currentWeekDisplay}
                onSubmitSuccess={(report) => {
                  // Optionally refresh the page or show additional success message
                  console.log('Extra info submitted successfully:', report);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 