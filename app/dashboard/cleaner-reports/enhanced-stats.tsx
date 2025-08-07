// Enhanced statistics component temporarily disabled until ready for production
export default function EnhancedStatistics() {
  return null;
}

/**
 * Original implementation preserved for future use:
 * 
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, Wrench, FileText, Home, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/cleaner-reports';

interface EnhancedStats {
  summary: {
    total_jobs: number;
    avg_duration: number;
    maintenance_needed: number;
    jobs_with_notes: number;
    properties_serviced: number;
  };
  problematic_units: Array<{
    listing_name: string;
    jobs_count: number;
    issue_percentage: number;
    avg_duration: number;
    recent_issues: string[];
    is_flagged: boolean;
  }>;
  common_issues: Array<{
    keyword: string;
    count: number;
    examples: string[];
    listings: string[];
  }>;
  alerts: Array<{
    message: string;
    severity: 'high' | 'medium' | 'low';
    context: string;
  }>;
}

function OriginalEnhancedStatistics() {
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('week');
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [timeframe]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/cleaner-reports/stats?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to load statistics');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading enhanced stats:', error);
      toast.error('Failed to load enhanced statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-4">Loading statistics...</div>;
  }

  if (!stats) {
    return <div className="p-4">No statistics available.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Enhanced Statistics</h2>
        <Select value={timeframe} onValueChange={(value: 'week' | 'month') => setTimeframe(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Wrench className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Maintenance Needed</p>
                <p className="text-2xl font-bold">{stats.summary.maintenance_needed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Jobs with Notes</p>
                <p className="text-2xl font-bold">{stats.summary.jobs_with_notes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Home className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Properties Serviced</p>
                <p className="text-2xl font-bold">{stats.summary.properties_serviced}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.alerts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Important Alerts</h3>
          <div className="space-y-2">
            {stats.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg flex items-start space-x-3 ${
                  alert.severity === 'high'
                    ? 'bg-red-50 text-red-700'
                    : alert.severity === 'medium'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {alert.severity === 'high' ? (
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm opacity-90">{alert.context}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.problematic_units.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Units Needing Attention</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recent Issues</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.problematic_units.map((unit, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {unit.listing_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {unit.jobs_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        unit.issue_percentage >= 75 ? 'bg-red-100 text-red-800' :
                        unit.issue_percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {Math.round(unit.issue_percentage)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {Math.round(unit.avg_duration)}m
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {unit.recent_issues[0] || 'No recent issues'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.common_issues.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Common Issues</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.common_issues.map((issue, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900 capitalize">{issue.keyword}</h4>
                      <p className="text-sm text-gray-500">Found in {issue.count} reports</p>
                    </div>
                    <span className="text-xs font-medium text-gray-500">
                      {issue.listings.length} properties affected
                    </span>
                  </div>
                  {issue.examples.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600 italic">
                      &quot;{issue.examples[0]}&quot;
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
*/ 