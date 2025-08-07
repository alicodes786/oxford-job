'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { PaymentReport } from '@/lib/payment-reports';
import { Cleaner } from '@/lib/models';
import { use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = use(params);
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <ReportDetailContent reportId={id} />
    </div>
  );
}

function ReportDetailContent({ reportId }: { reportId: string }) {
  const { user } = useAuth();
  const [report, setReport] = useState<PaymentReport | null>(null);
  const [cleaner, setCleaner] = useState<Cleaner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [referrer, setReferrer] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');

  // Get referrer from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get('from') || '';
    setReferrer(fromParam);
  }, []);

  // Load report and cleaner details
  const loadReport = async () => {
    try {
      // Load report
      const reportResponse = await fetch(`/api/payment-reports/${reportId}`);
      const reportData = await reportResponse.json();
      
      if (!reportData.success) {
        toast.error('Failed to load report');
        return;
      }
      
      setReport(reportData.report);

      // Load cleaner details
      const cleanerResponse = await fetch(`/api/cleaners/${reportData.report.cleaner_uuid}`);
      const cleanerData = await cleanerResponse.json();
      
      if (cleanerData.success) {
        setCleaner(cleanerData.cleaner);
      }
    } catch (error) {
      console.error('Error loading report details:', error);
      toast.error('Failed to load report details');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadReport();
  }, [reportId]);

  const updateStatus = async (newStatus: string) => {
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can update payment status');
      return;
    }

    if (!report) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/payment-reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === 'rejected' ? { message: rejectMessage } : {})
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Ensure extra_info is preserved in the updated report
        setReport({
          ...data.report,
          extra_info: report.extra_info // Preserve the existing extra_info
        });
        toast.success(`Payment report ${newStatus} successfully`);
        loadReport(); // Reload report data
        setShowRejectDialog(false);
        setRejectMessage('');
      } else {
        toast.error(data.error || `Failed to mark report as ${newStatus}`);
      }
    } catch (error) {
      console.error(`Error updating payment report status to ${newStatus}:`, error);
      toast.error(`Failed to mark report as ${newStatus}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle status update for a specific bank account
  const handleBankAccountStatusUpdate = async (bankAccount: string, newStatus: 'approved' | 'paid') => {
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can update payment status');
      return;
    }

    if (!report) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/payment-reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          status: newStatus,
          bankAccount: bankAccount
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setReport(data.report);
        toast.success(`Payment from ${bankAccount} ${newStatus} successfully`);
      } else {
        toast.error(data.error || `Failed to mark payment as ${newStatus}`);
      }
    } catch (error) {
      console.error(`Error updating payment status to ${newStatus}:`, error);
      toast.error(`Failed to mark payment as ${newStatus}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Get status for a specific bank account
  const getBankAccountStatus = (bankAccount: string) => {
    return report?.bank_account_statuses?.[bankAccount]?.status || 'pending';
  };

  // Render status buttons for a specific bank account
  const renderBankAccountStatusButtons = (bankAccount: string) => {
    if (!user || user.role !== 'admin') return null;

    const status = getBankAccountStatus(bankAccount);

    if (status === 'pending') {
      return (
        <button
          onClick={() => handleBankAccountStatusUpdate(bankAccount, 'approved')}
          disabled={isUpdating}
          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isUpdating ? 'Updating...' : 'Approve'}
        </button>
      );
    }

    if (status === 'approved') {
      return (
        <button
          onClick={() => handleBankAccountStatusUpdate(bankAccount, 'paid')}
          disabled={isUpdating}
          className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isUpdating ? 'Updating...' : 'Mark as Paid'}
        </button>
      );
    }

    if (status === 'paid') {
      return <span className="text-green-600">✓ Paid</span>;
    }

    return null;
  };

  const renderOverallStatusButtons = () => {
    if (!report) return null;

    const isDisabled = isUpdating;

    return (
      <div className="flex gap-2">
        {report.status !== 'approved' && report.status !== 'paid' && (
          <button
            onClick={() => updateStatus('approved')}
            disabled={isDisabled}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Approve'}
          </button>
        )}
        {report.status !== 'paid' && report.status === 'approved' && (
          <button
            onClick={() => updateStatus('paid')}
            disabled={isDisabled}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Mark as Paid'}
          </button>
        )}
        {report.status !== 'rejected' && report.status !== 'paid' && (
          <button
            onClick={() => setShowRejectDialog(true)}
            disabled={isDisabled}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Reject'}
          </button>
        )}
      </div>
    );
  };

  // Navigation functions
  const goBackToReports = () => {
    window.location.href = '/dashboard/reports';
  };

  const goBackToHistoric = () => {
    window.location.href = '/dashboard/reports/historic';
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!report || !cleaner) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">Report not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={referrer === 'historic' ? goBackToHistoric : goBackToReports}
              className="text-blue-600 hover:text-blue-900"
            >
              ← Back to {referrer === 'historic' ? 'Historic Reports' : 'Reports'}
            </button>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">
              Payment Report Details
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              report.status === 'paid' ? 'bg-green-100 text-green-800' :
              report.status === 'approved' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Cleaner Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Cleaner Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="mt-1 text-sm text-gray-900">{cleaner?.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Hourly Rate</p>
              <p className="mt-1 text-sm text-gray-900">£{report.base_rate.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Summary section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Summary</h2>
            <div className="flex items-center">
              {renderOverallStatusButtons()}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Hours</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{report.total_hours}</p>
              {report.extra_info && report.extra_info.length > 0 && (
                <p className="text-xs text-blue-600">
                  (includes {report.extra_info.reduce((sum, info) => sum + (info.extra_hours || 0), 0)}h extra)
                </p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="mt-1 text-2xl font-semibold text-green-600">£{report.total_amount.toFixed(2)}</p>
              {report.extra_info && report.extra_info.length > 0 && (
                <p className="text-xs text-blue-600">
                  (includes £{(report.extra_info.reduce((sum, info) => sum + (info.extra_hours || 0), 0) * report.base_rate).toFixed(2)} extra)
                </p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Properties</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{report.report_data?.summary?.total_properties || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Assignments</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{report.report_data?.summary?.total_assignments || 0}</p>
            </div>
          </div>
        </div>

        {/* Extra Info Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Extra Information</h2>
          {report.extra_info && report.extra_info.length > 0 ? (
            <div className="space-y-4">
              {report.extra_info.map((info, index) => (
                <div key={info.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Extra Report {index + 1}</h3>
                    <span className="text-xs text-gray-500">
                      Submitted: {new Date(info.created_at).toLocaleDateString()} at {new Date(info.created_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg mb-2">
                    <p className="text-sm font-medium text-green-600">Extra Hours</p>
                    <p className="mt-1 text-xl font-semibold text-green-900">
                      {info.extra_hours > 0 ? `${info.extra_hours} hours` : 'None'}
                    </p>
                    {info.extra_hours > 0 && (
                      <p className="text-sm text-green-700 mt-1">
                        ≈ £{(info.extra_hours * report.base_rate).toFixed(2)} at base rate
                      </p>
                    )}
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-purple-600">Notes</p>
                    <p className="mt-1 text-sm text-purple-900">
                      {info.notes && info.notes.trim() ? (
                        <span className="italic">"{info.notes}"</span>
                      ) : (
                        'No notes provided'
                      )}
                    </p>
                  </div>

                  {info.listing_id && (
                    <div className="mt-2 text-xs text-gray-600">
                      Property: {info.listing_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No extra information submitted by cleaner for this week.</p>
          )}
        </div>

        {/* Status message based on current payment status */}
        <div className="mt-4">
          <div className="flex">
            <div className="ml-3">
              {report.status === 'paid' && (
                <p className="text-sm text-blue-700">
                  <strong>Payment Status:</strong> This extra work has been approved and payment has been completed.
                </p>
              )}
              {report.status === 'approved' && (
                <p className="text-sm text-blue-700">
                  <strong>Payment Status:</strong> This extra work has been approved for payment.
                </p>
              )}
              {report.status === 'pending' && (
                <p className="text-sm text-blue-700">
                  <strong>Payment Status:</strong> This extra work is pending review and approval.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* No Extra Info Message */}
        {!report.extra_info && (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">No extra information submitted by cleaner for this week</p>
          </div>
        )}

        {/* Breakdown by Listing */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Breakdown by Listing</h2>
            <p className="text-sm text-gray-600 mb-4">
              This shows the total hours worked and amount for each property.
            </p>
          </div>
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
                {report?.report_data?.breakdown_by_listing && (() => {
                  // Group listings by base name
                  const listingSummary: Record<string, { hours: number; amount: number }> = {};
                  
                  Object.entries(report.report_data.breakdown_by_listing).forEach(([listingName, data]) => {
                    // Get the base group name for the listing
                    const groupName = getListingGroupName(listingName.replace(' (Extra Hours)', ''));
                    
                    if (!listingSummary[groupName]) {
                      listingSummary[groupName] = { hours: 0, amount: 0 };
                    }
                    listingSummary[groupName].hours += data.hours;
                    listingSummary[groupName].amount += data.amount;
                  });

                  // Custom sorting for payment reports - specific order requested by client
                  const customOrder = ['44', '422', '1LSR', '5WJ', '5WJ2', '212', '5A', '2A', '9RA', '1CT', '13', 'BR', '5C', '185', '234'];
                  const sortedListings = Object.entries(listingSummary).sort(([a], [b]) => {
                    const aIndex = customOrder.indexOf(a);
                    const bIndex = customOrder.indexOf(b);
                    
                    // If both are in the custom order, sort by their position
                    if (aIndex !== -1 && bIndex !== -1) {
                      return aIndex - bIndex;
                    }
                    
                    // If only one is in the custom order, prioritize it
                    if (aIndex !== -1) return -1;
                    if (bIndex !== -1) return 1;
                    
                    // If neither is in the custom order, fall back to alphabetical
                    return a.localeCompare(b);
                  });

                  return [...sortedListings.map(([property, data]) => (
                    <tr key={property}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {property}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {data.hours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        £{data.amount.toFixed(2)}
                      </td>
                    </tr>
                  )),
                  <tr key="total" className="bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {report.total_hours}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      £{report.total_amount.toFixed(2)}
                    </td>
                  </tr>]
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Breakdown by Bank Account */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Payment Breakdown by Bank Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              This shows how much needs to be paid from each bank account for the properties associated with it.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Properties
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {report?.report_data?.breakdown_by_bank_account && Object.entries(report.report_data.breakdown_by_bank_account).map(([account, data]) => (
                  <tr key={account}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {data.properties.join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      £{data.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Assignments */}
        {report.report_data?.assignments && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Detailed Assignments</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Property
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <tr key={assignment.uuid}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(assignment.checkout_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignment.listing_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignment.hours}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        £{assignment.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Report</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be sent to the cleaner.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-message">Rejection Message</Label>
            <Textarea
              id="rejection-message"
              value={rejectMessage}
              onChange={(e) => setRejectMessage(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => updateStatus('rejected')}
              disabled={isUpdating || !rejectMessage.trim()}
            >
              Reject Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 