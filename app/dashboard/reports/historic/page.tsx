'use client';

import { useState, useEffect } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { PaymentReport } from '@/lib/payment-reports';
import { Cleaner } from '@/lib/models';

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

// Format date for input field (YYYY-MM-DD)
function formatDateForInput(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

// Date range presets
const getDateRangePresets = () => {
  const now = new Date();
  return {
    '3months': {
      label: 'Last 3 Months',
      from: startOfMonth(subMonths(now, 3)),
      to: endOfMonth(now)
    },
    '6months': {
      label: 'Last 6 Months', 
      from: startOfMonth(subMonths(now, 6)),
      to: endOfMonth(now)
    },
    '12months': {
      label: 'Last 12 Months',
      from: startOfMonth(subMonths(now, 12)),
      to: endOfMonth(now)
    },
    'custom': {
      label: 'Custom Range',
      from: null,
      to: null
    }
  };
};

interface HistoricReportsPageProps {}

export default function HistoricReportsPage({}: HistoricReportsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <HistoricReportsPageContent />
    </div>
  );
}

function HistoricReportsPageContent() {
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('3months');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [totalReports, setTotalReports] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const dateRangePresets = getDateRangePresets();

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

  // Load historic reports
  const loadHistoricReports = async () => {
    if (!selectedCleanerId) {
      setReports([]);
      return;
    }

    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('cleaner_uuid', selectedCleanerId);
      queryParams.set('limit', '1000'); // Get all reports for the cleaner
      
      // Add date range filters
      if (selectedDateRange !== 'custom') {
        const preset = dateRangePresets[selectedDateRange as keyof typeof dateRangePresets];
        if (preset.from) queryParams.set('date_from', formatDateForInput(preset.from));
        if (preset.to) queryParams.set('date_to', formatDateForInput(preset.to));
      } else if (customDateFrom && customDateTo) {
        queryParams.set('date_from', customDateFrom);
        queryParams.set('date_to', customDateTo);
      }

      const response = await fetch(`/api/payment-reports?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        const reportsList = data.reports as PaymentReport[];
        setReports(reportsList);
        setTotalReports(data.count);
      } else {
        toast.error('Failed to load historic reports');
      }
    } catch (error) {
      console.error('Error loading historic reports:', error);
      toast.error('Failed to load historic reports');
    } finally {
      setIsLoading(false);
    }
  };

  // Load reports when filters change
  useEffect(() => {
    loadHistoricReports();
  }, [selectedCleanerId, selectedDateRange, customDateFrom, customDateTo]);

  // Calculate summary statistics
  const calculateSummary = () => {
    if (reports.length === 0) return { totalHours: 0, totalAmount: 0, avgWeeklyHours: 0, avgWeeklyAmount: 0 };
    
    const totalHours = reports.reduce((sum, report) => sum + report.total_hours, 0);
    const totalAmount = reports.reduce((sum, report) => sum + report.total_amount, 0);
    const avgWeeklyHours = totalHours / reports.length;
    const avgWeeklyAmount = totalAmount / reports.length;
    
    return { totalHours, totalAmount, avgWeeklyHours, avgWeeklyAmount };
  };

  const summary = calculateSummary();

  // Export to CSV
  const exportToCSV = () => {
    if (reports.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    
    const cleaner = cleaners.find(c => c.id === selectedCleanerId);
    const csvHeaders = ['Week', 'Hours', 'Amount', 'Base Rate', 'Created At'];
    const csvData = reports.map(report => [
      formatWeekRange(new Date(report.week_start)),
      report.total_hours,
      report.total_amount,
      report.base_rate,
      new Date(report.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleaner?.name || 'cleaner'}_payment_history.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    setIsExporting(false);
    toast.success('Export completed');
  };

  // Export to PDF (simplified version)
  const exportToPDF = () => {
    if (reports.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    
    const cleaner = cleaners.find(c => c.id === selectedCleanerId);
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment History - ${cleaner?.name || 'Cleaner'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .header { margin-bottom: 20px; }
          .summary { background-color: #f8f9fa; padding: 15px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Payment History Report</h1>
          <p><strong>Cleaner:</strong> ${cleaner?.name || 'Unknown'}</p>
          <p><strong>Date Range:</strong> ${selectedDateRange === 'custom' ? `${customDateFrom} to ${customDateTo}` : dateRangePresets[selectedDateRange as keyof typeof dateRangePresets].label}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="summary">
          <h3>Summary</h3>
          <p><strong>Total Hours:</strong> ${summary.totalHours.toFixed(1)}</p>
          <p><strong>Total Amount:</strong> £${summary.totalAmount.toFixed(2)}</p>
          <p><strong>Average Weekly Hours:</strong> ${summary.avgWeeklyHours.toFixed(1)}</p>
          <p><strong>Average Weekly Amount:</strong> £${summary.avgWeeklyAmount.toFixed(2)}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Hours</th>
              <th>Amount</th>
              <th>Base Rate</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            ${reports.map(report => `
              <tr>
                <td>${formatWeekRange(new Date(report.week_start))}</td>
                <td>${report.total_hours}</td>
                <td>£${report.total_amount.toFixed(2)}</td>
                <td>£${report.base_rate.toFixed(2)}</td>
                <td>${new Date(report.created_at).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    
    setIsExporting(false);
    toast.success('PDF export opened in new window');
  };

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Historic Payment Reports</h1>
            <p className="mt-2 text-sm text-gray-700">
              View detailed payment history for individual cleaners
            </p>
          </div>
          <div>
            <button
              onClick={() => window.location.href = '/dashboard/reports'}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              Back to Reports
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Filter Historic Reports</h2>
          <div className="space-y-4">
            {/* Cleaner Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Cleaner</label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={selectedCleanerId}
                onChange={(e) => setSelectedCleanerId(e.target.value)}
              >
                <option value="">Choose a cleaner...</option>
                {cleaners.map(cleaner => (
                  <option key={cleaner.id} value={cleaner.id}>
                    {cleaner.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(dateRangePresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedDateRange(key)}
                    className={`px-3 py-2 text-sm rounded-md border ${
                      selectedDateRange === key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {selectedDateRange === 'custom' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {selectedCleanerId && reports.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Summary Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{summary.totalHours.toFixed(1)}</div>
                <div className="text-sm text-gray-600">Total Hours</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">£{summary.totalAmount.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Total Amount</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{summary.avgWeeklyHours.toFixed(1)}</div>
                <div className="text-sm text-gray-600">Avg Weekly Hours</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">£{summary.avgWeeklyAmount.toFixed(2)}</div>
                <div className="text-sm text-gray-600">Avg Weekly Amount</div>
              </div>
            </div>
          </div>
        )}

        {/* Export Controls */}
        {selectedCleanerId && reports.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Export Options</h2>
            <div className="flex space-x-4">
              <button
                onClick={exportToCSV}
                disabled={isExporting}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export to CSV'}
              </button>
              <button
                onClick={exportToPDF}
                disabled={isExporting}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export to PDF'}
              </button>
            </div>
          </div>
        )}

        {/* Historic Reports Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              {selectedCleanerId ? `Payment History - ${cleaners.find(c => c.id === selectedCleanerId)?.name}` : 'Payment History'}
            </h2>
            {selectedCleanerId && (
              <p className="text-sm text-gray-600 mt-1">
                {reports.length} reports found
              </p>
            )}
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Week
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extra Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : !selectedCleanerId ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    Please select a cleaner to view their payment history
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    No payment reports found for the selected date range
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatWeekRange(new Date(report.week_start))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.total_hours}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      £{report.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      £{report.base_rate.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {formatExtraInfo(report)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => window.location.href = `/dashboard/reports/${report.id}?from=historic`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 