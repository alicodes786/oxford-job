import { NextResponse } from 'next/server';
import { syncBookingEventsForListings, getLatestSyncStatus } from '@/lib/models';

export const dynamic = 'force-dynamic'; // No caching

export async function POST(request: Request) {
  try {
    // Parse request body for optional date range parameters
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body;
    
    // Check if there's already a sync in progress
    const latestSync = await getLatestSyncStatus();
    
    if (latestSync && latestSync.status === 'running') {
      const lastSyncTime = new Date(latestSync.last_sync_time);
      const currentTime = new Date();
      const minutesSinceLastSync = (currentTime.getTime() - lastSyncTime.getTime()) / (1000 * 60);
      
      // If the last sync started less than 5 minutes ago, consider it still running
      if (minutesSinceLastSync < 5) {
        return NextResponse.json({ 
          success: false, 
          error: 'A sync operation is already in progress', 
          syncStarted: latestSync.last_sync_time 
        }, { status: 409 });
      }
      
      // Otherwise, the sync might have stalled
      console.warn('Previous sync might have stalled. Starting a new one.');
    }
    
    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    console.log(`Using base URL for sync: ${baseUrl}`);
    
    // Perform sync with versioning and date range
    const result = await syncBookingEventsForListings(baseUrl, startDate, endDate);
    
    return NextResponse.json({
      success: true,
      message: 'Successfully synced iCal feeds',
      stats: {
        listingsProcessed: result.listingsProcessed,
        feedsProcessed: result.feedsProcessed,
        eventsAdded: result.eventsAdded,
        eventsUpdated: result.eventsUpdated,
        eventsDeactivated: result.eventsDeactivated,
        eventsVersioned: result.eventsVersioned
      }
    });
  } catch (error) {
    console.error('Error syncing iCal feeds:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
} 