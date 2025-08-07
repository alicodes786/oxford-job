'use client';

import { useState, useEffect } from 'react';

interface SyncReport {
  id: string;
  sync_type: 'single' | 'all';
  status: 'success' | 'error' | 'partial';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  listing_id: string | null;
  listing_name: string | null;
  listings_processed: number;
  feeds_processed: number;
  events_total: number;
  events_added: number;
  events_updated: number;
  events_deactivated: number;
  events_replaced: number;
  events_unchanged: number;
  events_errors: number;
  notifications_sent: number;
  error_message: string | null;
  results_data: any;
}

interface SyncStatistics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  avg_duration_ms: number;
  total_events_processed: number;
  total_events_added: number;
  total_events_updated: number;
  total_events_deactivated: number;
}

export default function SyncReportsPage() {
  const [reports, setReports] = useState<SyncReport[]>([]);
  const [statistics, setStatistics] = useState<SyncStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'single' | 'all_sync'>('all');

  useEffect(() => {
    fetchSyncReports();
  }, [filter]);

  const fetchSyncReports = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '20',
        days: '30'
      });
      
      if (filter !== 'all') {
        params.append('type', filter === 'all_sync' ? 'all' : 'single');
      }

      const response = await fetch(`/api/sync-reports?${params}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data.reports);
        setStatistics(data.data.statistics);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch sync reports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'partial': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading sync reports...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Sync Reports</h1>
        
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Total Syncs (30d)</h3>
              <p className="text-2xl font-bold text-gray-900">{statistics.total_syncs}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
              <p className="text-2xl font-bold text-green-600">
                {statistics.total_syncs > 0 
                  ? Math.round((statistics.successful_syncs / statistics.total_syncs) * 100)
                  : 0}%
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Avg Duration</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(statistics.avg_duration_ms)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">Events Processed</h3>
              <p className="text-2xl font-bold text-blue-600">{statistics.total_events_processed}</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by type:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="all">All Syncs</option>
            <option value="single">Single Listing</option>
            <option value="all_sync">All Listings</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Reports Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Listing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Started
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Events
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Added/Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    report.sync_type === 'single' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {report.sync_type === 'single' ? 'Single' : 'All Listings'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.listing_name || `${report.listings_processed} listings`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(report.started_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDuration(report.duration_ms)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {report.events_total}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="text-green-600">+{report.events_added}</span>
                  {' / '}
                  <span className="text-blue-600">~{report.events_updated}</span>
                  {report.events_errors > 0 && (
                    <>
                      {' / '}
                      <span className="text-red-600">!{report.events_errors}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {reports.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No sync reports found</p>
          </div>
        )}
      </div>
    </div>
  );
} 