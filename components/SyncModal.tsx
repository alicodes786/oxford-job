'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, RefreshCw, Bug, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { syncAllListings, syncSingleListing } from '@/lib/sync-utils';
import type { SyncResult, SyncProgress } from '@/lib/sync-utils';
import type { Listing } from '@/lib/models';
import SyncDebugView from './SyncDebugView';

interface SyncStatus {
  status: 'pending' | 'syncing' | 'success' | 'error';
  result?: SyncResult;
  errorMessage?: string;
}

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => Promise<void> | void;
}

export default function SyncModal({ isOpen, onClose, onSyncComplete }: SyncModalProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, SyncStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [currentSyncingListing, setCurrentSyncingListing] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [expandedDebugListing, setExpandedDebugListing] = useState<string | null>(null);

  // Fetch listings when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchListings();
    }
  }, [isOpen]);

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/listings');
      const data = await response.json();
      
      if (data.success) {
        setListings(data.listings);
        // Initialize all listings with pending status
        const initialStatuses: Record<string, SyncStatus> = {};
        data.listings.forEach((listing: Listing) => {
          initialStatuses[listing.id] = { status: 'pending' };
        });
        setSyncStatuses(initialStatuses);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncListing = async (listing: Listing) => {
    setSyncStatuses(prev => ({
      ...prev,
      [listing.id]: { status: 'syncing' }
    }));

    try {
      const result = await syncSingleListing(listing.id);
      
      setSyncStatuses(prev => ({
        ...prev,
        [listing.id]: { 
          status: 'success',
          result
        }
      }));
      
      // Refresh calendar after successful sync
      if (onSyncComplete) {
        await onSyncComplete();
      }
    } catch (error) {
      setSyncStatuses(prev => ({
        ...prev,
        [listing.id]: { 
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Network error'
        }
      }));
    }
  };

  const syncAllListingsHandler = async () => {
    setIsSyncing(true);
    setSyncProgress(null);
    setCurrentSyncingListing(null);
    
    // Reset all statuses to pending
    const pendingStatuses: Record<string, SyncStatus> = {};
    listings.forEach(listing => {
      pendingStatuses[listing.id] = { status: 'pending' };
    });
    setSyncStatuses(pendingStatuses);

    try {
      await syncAllListings((progress: SyncProgress) => {
        setSyncProgress(progress);
        
        // Update individual listing statuses based on progress
        const updatedStatuses: Record<string, SyncStatus> = { ...pendingStatuses };
        
        // Mark completed listings
        progress.results.forEach(result => {
          updatedStatuses[result.listingId] = {
            status: result.status,
            result: result.status === 'success' ? result : undefined,
            errorMessage: result.status === 'error' ? result.errorMessage : undefined
          };
        });
        
        // Mark currently syncing listing
        if (progress.currentListing) {
          const currentListing = listings.find(l => l.name === progress.currentListing);
          if (currentListing) {
            updatedStatuses[currentListing.id] = { status: 'syncing' };
            setCurrentSyncingListing(progress.currentListing);
          }
        } else {
          setCurrentSyncingListing(null);
        }
        
        setSyncStatuses(updatedStatuses);
      });
      
      // Refresh calendar after successful sync
      if (onSyncComplete) {
        await onSyncComplete();
      }
      
    } catch (error) {
      console.error('Error syncing all listings:', error);
    } finally {
      setIsSyncing(false);
      setCurrentSyncingListing(null);
    }
  };

  const getStatusIcon = (status: SyncStatus['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: SyncStatus['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-600';
      case 'syncing':
        return 'bg-blue-100 text-blue-600';
      case 'success':
        return 'bg-green-100 text-green-600';
      case 'error':
        return 'bg-red-100 text-red-600';
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      onClose();
      // Reset state when closing
      setSyncProgress(null);
      setCurrentSyncingListing(null);
    }
  };

  const progressPercentage = syncProgress ? (syncProgress.completed / syncProgress.total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sync Listings</DialogTitle>
          <DialogDescription>
            Sync calendar events for all listings. Each listing will be processed individually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={syncAllListingsHandler} 
              disabled={isSyncing || isLoading}
              className="flex items-center gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                'Sync All Listings'
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setDebugMode(!debugMode)}
              className="flex items-center gap-2"
              disabled={isSyncing}
            >
              <Bug className="h-4 w-4" />
              {debugMode ? 'Hide Debug' : 'Debug'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing in progress...' : 'Close'}
            </Button>
          </div>

          {/* Progress bar and current status */}
          {syncProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {syncProgress.completed} of {syncProgress.total} listings</span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              {/* Custom progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              {currentSyncingListing && (
                <div className="flex items-center gap-2 text-sm">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="text-blue-600">
                    {currentSyncingListing.includes(' listings in parallel') 
                      ? `Processing ${currentSyncingListing}` 
                      : `Currently syncing: ${currentSyncingListing}`
                    }
                  </span>
                </div>
              )}
              {syncProgress.completed > 0 && (
                <div className="text-xs text-gray-500">
                  Completed: {syncProgress.results.filter(r => r.status === 'success').length} successful, {' '}
                  {syncProgress.results.filter(r => r.status === 'error').length} failed
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {listings.map((listing) => {
                const syncStatus = syncStatuses[listing.id];
                if (!syncStatus) return null;

                return (
                  <div key={listing.id} className="border rounded-lg">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(syncStatus.status)}
                        <div>
                          <h3 className="font-medium">{listing.name}</h3>
                          <p className="text-sm text-gray-500">ID: {listing.external_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(syncStatus.status)}>
                          {syncStatus.status.charAt(0).toUpperCase() + syncStatus.status.slice(1)}
                        </Badge>
                        
                        {syncStatus.result && (
                          <div className="text-sm text-gray-600 relative group">
                            <div className="font-medium cursor-help">
                              {syncStatus.result.events} events synced
                            </div>
                            
                            {/* Tooltip with detailed breakdown on hover */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                              <div className="space-y-0.5">
                                <div>Feeds Processed: {syncStatus.result.feedsProcessed}</div>
                                <div>Events: {syncStatus.result.events}</div>
                                <div>Added: {syncStatus.result.added}</div>
                                <div>Updated: {syncStatus.result.updated}</div>
                                <div>Deactivated: {syncStatus.result.deactivated}</div>
                                <div>Replaced: {syncStatus.result.replaced}</div>
                                <div>Unchanged: {syncStatus.result.unchanged}</div>
                                <div>Errors: {syncStatus.result.errors}</div>
                              </div>
                              {/* Tooltip arrow */}
                              <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        )}
                        
                        {syncStatus.status !== 'syncing' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => syncListing(listing)}
                            disabled={isSyncing}
                          >
                            Sync
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Debug view - only show if debug mode is enabled and we have detailed logs */}
                    {debugMode && syncStatus.result?.detailedLogs && (
                      <div className="px-4 pb-4">
                        <SyncDebugView
                          detailedLogs={syncStatus.result.detailedLogs}
                          listingName={listing.name}
                          isExpanded={expandedDebugListing === listing.id}
                          onToggleExpanded={() => {
                            setExpandedDebugListing(
                              expandedDebugListing === listing.id ? null : listing.id
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Summary section */}
          {Object.keys(syncStatuses).length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Sync Summary</h4>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-400">
                    {Object.values(syncStatuses).filter(s => s.status === 'pending').length}
                  </div>
                  <div className="text-gray-600">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-blue-500">
                    {Object.values(syncStatuses).filter(s => s.status === 'syncing').length}
                  </div>
                  <div className="text-gray-600">Syncing</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-green-500">
                    {Object.values(syncStatuses).filter(s => s.status === 'success').length}
                  </div>
                  <div className="text-gray-600">Success</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-red-500">
                    {Object.values(syncStatuses).filter(s => s.status === 'error').length}
                  </div>
                  <div className="text-gray-600">Error</div>
                </div>
              </div>
            </div>
          )}

          {/* Error details */}
          {Object.values(syncStatuses).some(s => s.status === 'error') && (
            <div className="mt-4">
              <h4 className="font-medium text-red-600 mb-2">Errors</h4>
              <div className="space-y-1">
                {Object.entries(syncStatuses)
                  .filter(([_, status]) => status.status === 'error')
                  .map(([listingId, status]) => {
                    const listing = listings.find(l => l.id === listingId);
                    return (
                      <div key={listingId} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        <strong>{listing?.name}:</strong> {status.errorMessage}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 