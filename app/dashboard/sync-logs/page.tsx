'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ChevronRight,
  Search,
  Filter,
  Calendar,
  Database,
  Activity,
  TrendingUp,
  AlertCircle,
  Plus,
  Minus,
  Replace,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface SyncSession {
  id: string;
  created_at: string;
  sync_type: 'single' | 'all';
  target_listing_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'partial';
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  total_events_processed: number;
  total_added: number;
  total_updated: number;
  total_deactivated: number;
  total_replaced: number;
  total_unchanged: number;
  total_errors: number;
  error_message?: string;
  triggered_by?: string;
}

interface SyncLogEntry {
  id: string;
  created_at: string;
  operation: 'event_unchanged' | 'event_cancellations' | 'event_date_changes' | 'event_checkout_type_changes' | 'event_additions' | 'event_errors';
  event_id: string;
  listing_name: string;
  event_details: {
    checkinDate: string;
    checkoutDate: string;
    checkoutType?: string;
    title?: string;
  };
  reasoning: string;
  metadata?: any;
}

export default function SyncLogsPage() {
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SyncSession | null>(null);
  const [logEntries, setLogEntries] = useState<SyncLogEntry[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [operationCounts, setOperationCounts] = useState<Record<string, number>>({});
  
  // Filters
  const [filters, setFilters] = useState({
    syncType: 'all',
    status: 'all',
    listingName: '',
    startDate: '',
    endDate: '',
    operationType: 'all'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(20);

  // Start with no operations selected
  const [selectedOperations, setSelectedOperations] = useState<string[]>([]);

  // Get filtered entries - if no filters selected, show all
  const getFilteredEntries = () => {
    if (selectedOperations.length === 0) {
      return logEntries;
    }
    return logEntries.filter(entry => selectedOperations.includes(entry.operation));
  };

  // Calculate operation counts
  const calculateOperationCounts = (entries: SyncLogEntry[]) => {
    const counts: Record<string, number> = {};
    entries.forEach(entry => {
      counts[entry.operation] = (counts[entry.operation] || 0) + 1;
    });
    return counts;
  };

  useEffect(() => {
    fetchSyncSessions();
  }, [currentPage, filters]);

  const fetchSyncSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '1000', // Increase the limit for sessions list
        ...(filters.syncType && filters.syncType !== 'all' && { syncType: filters.syncType }),
        ...(filters.status && filters.status !== 'all' && { status: filters.status }),
        ...(filters.listingName && { listingName: filters.listingName }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });

      const response = await fetch(`/api/sync-logs?${params}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.data.sessions);
        setTotalPages(data.data.pagination.totalPages);
      } else {
        toast.error('Failed to fetch sync logs');
      }
    } catch (error) {
      console.error('Error fetching sync sessions:', error);
      toast.error('Failed to fetch sync logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId: string) => {
    setLoadingDetails(true);
    try {
      // Add a large limit to get all log entries
      const response = await fetch(`/api/sync-logs/${sessionId}?limit=10000`);
      const data = await response.json();

      if (data.success) {
        console.log('Fetched log entries:', data.data.logEntries);
        setLogEntries(data.data.logEntries);
        const counts = calculateOperationCounts(data.data.logEntries);
        console.log('Operation counts:', counts);
        setOperationCounts(counts);
      } else {
        toast.error('Failed to fetch session details');
      }
    } catch (error) {
      console.error('Error fetching session details:', error);
      toast.error('Failed to fetch session details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'partial':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'event_additions':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'event_cancellations':
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'event_date_changes':
        return <Replace className="h-4 w-4 text-blue-600" />;
      case 'event_checkout_type_changes':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'event_errors':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'event_additions':
        return 'bg-green-100 text-green-800';
      case 'event_cancellations':
        return 'bg-red-100 text-red-800';
      case 'event_date_changes':
        return 'bg-blue-100 text-blue-800';
      case 'event_checkout_type_changes':
        return 'bg-orange-100 text-orange-800';
      case 'event_errors':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'event_additions':
        return 'Add: New Bookings';
      case 'event_cancellations':
        return 'Delete: Cancelled Bookings';
      case 'event_date_changes':
        return 'Replaced: Booking Day Changes';
      case 'event_checkout_type_changes':
        return 'Update: Checkout Type Updates';
      case 'event_errors':
        return 'Errors';
      default:
        return operation.replace('event_', '').replace('_', ' ');
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const openSessionDetails = (session: SyncSession) => {
    setSelectedSession(session);
    fetchSessionDetails(session.id);
  };

  // Debug logs
  useEffect(() => {
    console.log('Current log entries:', logEntries);
    console.log('Selected operations:', selectedOperations);
  }, [logEntries, selectedOperations]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Logs</h1>
          <p className="text-muted-foreground">
            View detailed logs of all sync operations and their results.
          </p>
        </div>
        <Button onClick={fetchSyncSessions} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select
              value={filters.syncType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, syncType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sync Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="single">Single Listing</SelectItem>
                <SelectItem value="all_listings">All Listings</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.operationType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, operationType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Operation Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                <SelectItem value="event_additions">Additions</SelectItem>
                <SelectItem value="event_date_changes">Date Changes</SelectItem>
                <SelectItem value="event_checkout_type_changes">Checkout Changes</SelectItem>
                <SelectItem value="event_cancellations">Cancellations</SelectItem>
                <SelectItem value="event_unchanged">Unchanged</SelectItem>
                <SelectItem value="event_errors">Errors</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Listing name..."
              value={filters.listingName}
              onChange={(e) => setFilters(prev => ({ ...prev, listingName: e.target.value }))}
            />

            <Input
              type="date"
              placeholder="Start date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />

            <Input
              type="date"
              placeholder="End date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={fetchSyncSessions} variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
            <Button
              onClick={() => {
                setFilters({
                  syncType: 'all',
                  status: 'all',
                  listingName: '',
                  startDate: '',
                  endDate: '',
                  operationType: 'all'
                });
                setCurrentPage(1);
              }}
              variant="ghost"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sync Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No sync sessions found
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => openSessionDetails(session)}
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(session.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {session.sync_type === 'single' ? 'Single' : 'All Listings'}
                        </Badge>
                        {session.target_listing_name && (
                          <Badge variant="secondary">
                            {session.target_listing_name}
                          </Badge>
                        )}
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {format(new Date(session.created_at), 'MMM d, yyyy HH:mm:ss')} • 
                        Duration: {formatDuration(session.duration_seconds)} • 
                        Events: {session.total_events_processed}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="flex gap-2">
                        {session.total_added > 0 && (
                          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            {session.total_added}
                          </Badge>
                        )}
                        {session.total_deactivated > 0 && (
                          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                            <Trash2 className="h-3 w-3" />
                            {session.total_deactivated}
                          </Badge>
                        )}
                        {session.total_replaced > 0 && (
                          <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
                            <Replace className="h-3 w-3" />
                            {session.total_replaced}
                          </Badge>
                        )}
                        {session.total_updated > 0 && (
                          <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {session.total_updated}
                          </Badge>
                        )}
                        {session.total_errors > 0 && (
                          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {session.total_errors}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sync Session Details
              {selectedSession && (
                <Badge className={getStatusColor(selectedSession.status)}>
                  {selectedSession.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedSession && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="logs">
                  Log Entries ({logEntries.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Session Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>ID:</strong> {selectedSession.id}</div>
                      <div><strong>Type:</strong> {selectedSession.sync_type}</div>
                      <div><strong>Started:</strong> {selectedSession.started_at ? format(new Date(selectedSession.started_at), 'MMM d, yyyy HH:mm:ss') : 'N/A'}</div>
                      <div><strong>Completed:</strong> {selectedSession.completed_at ? format(new Date(selectedSession.completed_at), 'MMM d, yyyy HH:mm:ss') : 'N/A'}</div>
                      <div><strong>Duration:</strong> {formatDuration(selectedSession.duration_seconds)}</div>
                      {selectedSession.target_listing_name && (
                        <div><strong>Listing:</strong> {selectedSession.target_listing_name}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div><strong>Events Processed:</strong> {selectedSession.total_events_processed}</div>
                      <div><strong>Added:</strong> {selectedSession.total_added}</div>
                      <div><strong>Updated:</strong> {selectedSession.total_updated}</div>
                      <div><strong>Deactivated:</strong> {selectedSession.total_deactivated}</div>
                      <div><strong>Replaced:</strong> {selectedSession.total_replaced}</div>
                      <div><strong>Unchanged:</strong> {selectedSession.total_unchanged}</div>
                      <div><strong>Errors:</strong> {selectedSession.total_errors}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Operation Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Operation Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(operationCounts).map(([operation, count]) => (
                        <div key={operation} className="flex items-center gap-2 p-2 rounded-lg border">
                          {getOperationIcon(operation)}
                          <div className="flex-1">
                            <div className="font-medium">{getOperationLabel(operation)}</div>
                            <div className="text-sm text-gray-500">{count} events</div>
                          </div>
                          <Badge className={getOperationColor(operation)}>
                            {count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {selectedSession.error_message && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-red-600">Error Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-red-600 bg-red-50 p-4 rounded">
                        {selectedSession.error_message}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="logs">
                {loadingDetails ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Filters</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">Operation Types</div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedOperations([
                                    'event_additions',
                                    'event_date_changes',
                                    'event_checkout_type_changes',
                                    'event_cancellations',
                                    'event_unchanged',
                                    'event_errors'
                                  ])}
                                >
                                  Select All
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedOperations([])}
                                >
                                  Clear All
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { value: 'event_additions', label: 'Additions', icon: Plus },
                                { value: 'event_date_changes', label: 'Date Changes', icon: Calendar },
                                { value: 'event_checkout_type_changes', label: 'Checkout Changes', icon: Replace },
                                { value: 'event_cancellations', label: 'Cancellations', icon: Trash2 },
                                { value: 'event_unchanged', label: 'Unchanged', icon: Minus },
                                { value: 'event_errors', label: 'Errors', icon: AlertCircle }
                              ].map(({ value, label, icon: Icon }) => (
                                <Button
                                  key={value}
                                  variant={selectedOperations.includes(value) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOperations(prev => {
                                      if (prev.includes(value)) {
                                        return prev.filter(op => op !== value);
                                      } else {
                                        return [...prev, value];
                                      }
                                    });
                                  }}
                                  className="flex items-center gap-1"
                                >
                                  <Icon className="h-4 w-4" />
                                  {label}
                                  {operationCounts[value] > 0 && (
                                    <Badge variant="secondary" className="ml-1">
                                      {operationCounts[value]}
                                    </Badge>
                                  )}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {getFilteredEntries().length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No log entries found
                        </div>
                      ) : (
                        getFilteredEntries().map((entry) => (
                          <div key={entry.id} className="border rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              {getOperationIcon(entry.operation)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={getOperationColor(entry.operation)}>
                                    {entry.operation.replace('event_', '').replace('_', ' ').toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {format(new Date(entry.created_at), 'HH:mm:ss')}
                                  </span>
                                </div>
                                
                                <div className="text-sm space-y-1">
                                  <div><strong>Event ID:</strong> {entry.event_id}</div>
                                  <div><strong>Listing:</strong> {entry.listing_name}</div>
                                  <div>
                                    <strong>Dates:</strong>{' '}
                                    {entry.event_details.checkinDate && format(new Date(entry.event_details.checkinDate), 'MMM d')}{' '}
                                    →{' '}
                                    {entry.event_details.checkoutDate && format(new Date(entry.event_details.checkoutDate), 'MMM d')}
                                    {entry.event_details.checkoutType && (
                                      <span className="ml-2">({entry.event_details.checkoutType})</span>
                                    )}
                                  </div>
                                  <div className="text-gray-700">
                                    <strong>Reason:</strong> {entry.reasoning}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 