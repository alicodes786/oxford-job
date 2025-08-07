'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Plus, Edit, Trash2, Replace, AlertCircle, Minus, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SyncLogEntry {
  timestamp: string;
  operation: 'event_unchanged' | 'event_cancellations' | 'event_date_changes' | 'event_checkout_type_changes' | 'event_additions' | 'event_errors';
  eventId: string;
  listingName: string;
  eventDetails: {
    checkinDate: string;
    checkoutDate: string;
    checkoutType?: string;
    title?: string;
  };
  reasoning: string;
  metadata?: {
    existingEventId?: string;
    oldDates?: {
      checkin: string;
      checkout: string;
    };
    newDates?: {
      checkin: string;
      checkout: string;
    };
    errorDetails?: string;
    feedName?: string;
    uuid?: string;
    sqlOperation?: string;
    updatedFields?: string;
    matchType?: string;
    operation?: string;
    oldCheckoutType?: string;
    newCheckoutType?: string;
    oldEventId?: string;
    newEventId?: string;
    replacedEventUuid?: string;
    checkoutType?: string;
  };
}

interface SyncDebugViewProps {
  detailedLogs?: SyncLogEntry[];
  listingName: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

export default function SyncDebugView({ detailedLogs, listingName, isExpanded, onToggleExpanded }: SyncDebugViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  
  if (!detailedLogs || detailedLogs.length === 0) {
    return (
      <div className="mt-2 p-3 bg-gray-50 rounded border-l-4 border-gray-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">No debug logs available for this sync</span>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const filteredLogs = selectedFilter === 'all' 
    ? detailedLogs 
    : detailedLogs.filter(log => log.operation === selectedFilter);

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'event_unchanged': return <Minus className="h-4 w-4 text-gray-400" />;
      case 'event_cancellations': return <Trash2 className="h-4 w-4 text-red-600" />;
      case 'event_date_changes': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'event_checkout_type_changes': return <Replace className="h-4 w-4 text-orange-600" />;
      case 'event_additions': return <Plus className="h-4 w-4 text-green-600" />;
      case 'event_errors': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'event_unchanged': return 'bg-gray-100 text-gray-600';
      case 'event_cancellations': return 'bg-red-100 text-red-800';
      case 'event_date_changes': return 'bg-blue-100 text-blue-800';
      case 'event_checkout_type_changes': return 'bg-orange-100 text-orange-800';
      case 'event_additions': return 'bg-green-100 text-green-800';
      case 'event_errors': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get operation counts
  const operationCounts = detailedLogs.reduce((acc, log) => {
    acc[log.operation] = (acc[log.operation] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filterTabs = [
    { key: 'all', label: 'All', count: detailedLogs.length },
    { key: 'event_unchanged', label: 'Unchanged', count: detailedLogs.filter(log => log.operation === 'event_unchanged').length },
    { key: 'event_additions', label: 'Additions', count: detailedLogs.filter(log => log.operation === 'event_additions').length },
    { key: 'event_checkout_type_changes', label: 'Checkout Changes', count: detailedLogs.filter(log => log.operation === 'event_checkout_type_changes').length },
    { key: 'event_date_changes', label: 'Date Changes', count: detailedLogs.filter(log => log.operation === 'event_date_changes').length },
    { key: 'event_cancellations', label: 'Cancellations', count: detailedLogs.filter(log => log.operation === 'event_cancellations').length },
    { key: 'event_errors', label: 'Errors', count: detailedLogs.filter(log => log.operation === 'event_errors').length }
  ];

  return (
    <div className="mt-4 border border-gray-200 rounded-lg bg-white">
      <button
        onClick={onToggleExpanded}
        className="w-full px-4 py-3 text-left flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-t-lg"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            🔍 Debug Logs - {listingName}
          </h3>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {detailedLogs.length} operations
        </Badge>
      </button>

      {isExpanded && (
        <div className="p-4">
          {/* Database Operations Summary */}
          <div className="bg-gray-50 p-4 rounded-lg border mb-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Database className="h-5 w-5 mr-2" />
              Database Operations Summary
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Total Operations</div>
                <div className="text-lg font-bold">{detailedLogs.length}</div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">SQL Writes</div>
                <div className="text-lg font-bold text-blue-600">
                  {detailedLogs.filter(log => log.metadata?.sqlOperation).length}
                </div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Database INSERTs</div>
                <div className="text-lg font-bold text-green-600">
                  {detailedLogs.filter(log => log.metadata?.sqlOperation?.includes('INSERT')).length}
                </div>
              </div>
              <div className="bg-white p-3 rounded border">
                <div className="text-sm text-gray-600">Database UPDATEs</div>
                <div className="text-lg font-bold text-orange-600">
                  {detailedLogs.filter(log => log.metadata?.sqlOperation?.includes('UPDATE') && !log.metadata?.sqlOperation?.includes('INSERT')).length}
                </div>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedFilter(tab.key)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  selectedFilter === tab.key
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Logs list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredLogs.map((log, index) => (
              <div key={index} className="bg-white p-3 rounded border text-sm">
                <div className="flex items-start gap-2">
                  {getOperationIcon(log.operation)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getOperationColor(log.operation)}>
                        {log.operation.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-xs text-gray-500">
                        {formatTime(log.timestamp)}
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <strong>Event ID:</strong> {log.eventId}<br />
                      <strong>Dates:</strong> {formatDate(log.eventDetails.checkinDate)} → {formatDate(log.eventDetails.checkoutDate)}
                      {log.eventDetails.checkoutType && (
                        <> | <strong>Type:</strong> {log.eventDetails.checkoutType}</>
                      )}
                      {log.eventDetails.title && (
                        <> | <strong>Title:</strong> {log.eventDetails.title}</>
                      )}
                    </div>
                    
                    <div className="text-gray-700 mb-2">
                      <strong>Reason:</strong> {log.reasoning}
                    </div>
                    
                    {log.metadata && (
                      <div className="bg-gray-50 p-2 rounded text-xs">
                        <strong>Details:</strong>
                        {log.metadata.uuid && <div>UUID: {log.metadata.uuid}</div>}
                        {log.metadata.existingEventId && <div>Existing Event ID: {log.metadata.existingEventId}</div>}
                        {log.metadata.feedName && <div>Feed: {log.metadata.feedName}</div>}
                        {log.metadata.sqlOperation && <div>SQL Operation: {log.metadata.sqlOperation}</div>}
                        {log.metadata.updatedFields && <div>Updated Fields: {log.metadata.updatedFields}</div>}
                        {log.metadata.oldCheckoutType && log.metadata.newCheckoutType && (
                          <div>Checkout Type: {log.metadata.oldCheckoutType} → {log.metadata.newCheckoutType}</div>
                        )}
                        {log.metadata.oldEventId && log.metadata.newEventId && (
                          <div>Event ID: {log.metadata.oldEventId} → {log.metadata.newEventId}</div>
                        )}
                        {log.metadata.oldDates && (
                          <div>Old Dates: {formatDate(log.metadata.oldDates.checkin)} → {formatDate(log.metadata.oldDates.checkout)}</div>
                        )}
                        {log.metadata.newDates && (
                          <div>New Dates: {formatDate(log.metadata.newDates.checkin)} → {formatDate(log.metadata.newDates.checkout)}</div>
                        )}
                        {log.metadata.replacedEventUuid && (
                          <div>Replaced Event UUID: {log.metadata.replacedEventUuid}</div>
                        )}
                        {log.metadata.errorDetails && (
                          <div className="text-red-600">Error: {log.metadata.errorDetails}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 