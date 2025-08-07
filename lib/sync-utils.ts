// Utility functions for syncing listings client-side to avoid Vercel timeout limits

import { Listing } from './models';

export interface SyncResult {
  listingId: string;
  listingName: string;
  feedsProcessed: number;
  added: number;
  updated: number;
  deactivated: number;
  replaced: number;
  unchanged: number;
  errors: number;
  events: number;
  status: 'success' | 'error';
  errorMessage?: string;
  reportId?: string;
  sessionId?: string; // Database session ID
  detailedLogs?: any[]; // SyncLogEntry[]
}

export interface SyncProgress {
  total: number;
  completed: number;
  currentListing?: string;
  results: SyncResult[];
  reportId?: string; // For the overall sync report (when using sync-all)
  sessionId?: string; // Database session ID for the overall sync
}

/**
 * Sync all listings using the centralized sync-all-listings endpoint
 * This provides better performance and centralized logging
 */
export async function syncAllListingsCentralized(baseUrl?: string): Promise<SyncProgress> {
  try {
    console.log('Starting centralized sync for all listings...');
    
    // Use provided baseUrl or default to relative path
    const apiUrl = baseUrl ? `${baseUrl}/api/sync-all-listings` : '/api/sync-all-listings';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to sync listings');
    }
    
    console.log(`Centralized sync completed. Session: ${data.sessionId}`);
    console.log(`Summary: ${data.summary.totalEvents} events, ${data.summary.totalAdded} added, ${data.summary.totalUpdated} updated, ${data.summary.totalErrors} errors`);
    
    return {
      total: data.summary.totalListings,
      completed: data.summary.totalListings,
      results: data.results,
      sessionId: data.sessionId
    };
  } catch (error) {
    console.error('Error in syncAllListingsCentralized:', error);
    throw error;
  }
}

/**
 * Sync all listings by iterating through each one and calling the individual sync API
 * This avoids Vercel's 10s timeout limit by making individual API calls
 * Creates a unified "all" sync session to group all individual listing syncs
 * Processes listings in parallel batches for better performance
 */
export async function syncAllListings(
  onProgress?: (progress: SyncProgress) => void,
  batchSize: number = 5,  // Configurable batch size, defaults to 5
  urlTransformer?: (url: string) => string, // Function to transform relative URLs to absolute URLs
  triggeredBy: 'manual' | 'automatic' = 'manual' // Source of the sync trigger
): Promise<SyncProgress> {
  try {
    console.log(`🚀 Starting ${triggeredBy} sync for all listings with batch size: ${batchSize}`);
    
    // First, get all listings
    const listingsUrl = urlTransformer ? urlTransformer('/api/listings') : '/api/listings';
    const listingsResponse = await fetch(listingsUrl);
    const listingsData = await listingsResponse.json();
    
    if (!listingsData.success || !listingsData.listings) {
      throw new Error('Failed to fetch listings');
    }

    const listings: Listing[] = listingsData.listings;
    console.log(`📋 Found ${listings.length} listings to sync`);
    
    // Filter out manual listings (those with external_id starting with 'manual-')
    const syncableListings = listings.filter(listing => 
      !listing.external_id?.startsWith('manual-')
    );
    
    console.log(`📋 Filtered to ${syncableListings.length} syncable listings (excluded ${listings.length - syncableListings.length} manual listings)`);
    
    // Create a unified "all" sync session first
    const sessionUrl = urlTransformer ? urlTransformer('/api/sync-session') : '/api/sync-session';
    const sessionResponse = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        syncType: 'all',
        totalListings: syncableListings.length,
        triggeredBy // Pass the trigger source
      })
    });
    
    const sessionData = await sessionResponse.json();
    if (!sessionData.success) {
      throw new Error('Failed to create sync session');
    }
    
    const sessionId = sessionData.sessionId;
    console.log(`Created unified sync session: ${sessionId}`);
    
    const results: SyncResult[] = [];
    
    const progress: SyncProgress = {
      total: syncableListings.length,
      completed: 0,
      results: [],
      sessionId: sessionId
    };
    
    // Call the progress callback with initial state
    if (onProgress) {
      onProgress(progress);
    }
    
    // Process listings in batches for parallel execution
    const BATCH_SIZE = batchSize;
    const totalBatches = Math.ceil(syncableListings.length / BATCH_SIZE);
    
    console.log(`📦 Processing ${syncableListings.length} listings in ${totalBatches} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, syncableListings.length);
      const currentBatch = syncableListings.slice(batchStart, batchEnd);
      
      console.log(`🔄 Processing batch ${batchIndex + 1}/${totalBatches} (listings ${batchStart + 1}-${batchEnd})`);
      console.log(`   Batch includes: ${currentBatch.map(l => l.name).join(', ')}`);
      
      // Update progress to show which listings are currently syncing
      const currentListingNames = currentBatch.map(l => l.name);
      progress.currentListing = currentListingNames.length === 1 
        ? currentListingNames[0] 
        : `${currentListingNames.length} listings in parallel`;
      
      if (onProgress) {
        onProgress(progress);
      }
      
      // Create promises for all listings in this batch
      const batchPromises = currentBatch.map(async (listing) => {
        try {
          console.log(`   🔄 Starting sync for: ${listing.name}`);
          
          const syncUrl = urlTransformer ? urlTransformer('/api/sync-listing') : '/api/sync-listing';
          const syncResponse = await fetch(syncUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              listingId: listing.id,
              sessionId: sessionId  // Pass the unified session ID
            })
          });
          
          const syncData = await syncResponse.json();
          
          if (syncData.success && syncData.result) {
            console.log(`   ✅ Completed sync for ${listing.name}: SUCCESS (${syncData.result.events} events)`);
            return {
              ...syncData.result,
              reportId: syncData.reportId,
              sessionId: sessionId  // Ensure all results have the unified session ID
            };
          } else {
            console.log(`   ❌ Completed sync for ${listing.name}: FAILED - ${syncData.error}`);
            // Handle failed sync
            return {
              listingId: listing.id,
              listingName: listing.name,
              feedsProcessed: 0,
              added: 0,
              updated: 0,
              deactivated: 0,
              replaced: 0,
              unchanged: 0,
              errors: 1,
              events: 0,
              status: 'error' as const,
              errorMessage: syncData.error || 'Unknown error occurred',
              reportId: syncData.reportId,
              sessionId: sessionId
            };
          }
        } catch (error) {
          console.error(`   ❌ Error syncing listing ${listing.name}:`, error);
          
          // Return error result
          return {
            listingId: listing.id,
            listingName: listing.name,
            feedsProcessed: 0,
            added: 0,
            updated: 0,
            deactivated: 0,
            replaced: 0,
            unchanged: 0,
            errors: 1,
            events: 0,
            status: 'error' as const,
            errorMessage: error instanceof Error ? error.message : 'Network error',
            reportId: undefined,
            sessionId: sessionId
          };
        }
      });
      
      // Wait for all listings in this batch to complete
      console.log(`   ⏳ Waiting for batch ${batchIndex + 1} to complete...`);
      const batchResults = await Promise.all(batchPromises);
      
      // Add batch results to overall results
      results.push(...batchResults);
      
      // Update progress after completing the batch
      progress.completed = Math.min(batchEnd, syncableListings.length);
      progress.results = [...results];
      progress.currentListing = undefined; // Clear current listing after batch completion
      
      if (onProgress) {
        onProgress(progress);
      }
      
      // Log batch completion
      const successCount = batchResults.filter(r => r.status === 'success').length;
      const errorCount = batchResults.filter(r => r.status === 'error').length;
      const totalEvents = batchResults.reduce((sum, r) => sum + r.events, 0);
      console.log(`✅ Completed batch ${batchIndex + 1}/${totalBatches}: ${successCount} successful, ${errorCount} failed, ${totalEvents} total events`);
    }
    
    // Complete the unified session
    try {
      const completeUrl = urlTransformer ? urlTransformer('/api/sync-session/complete') : '/api/sync-session/complete';
      await fetch(completeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionId,
          results: results
        })
      });
    } catch (error) {
      console.error('Error completing sync session:', error);
    }
    
    const finalSuccessCount = results.filter(r => r.status === 'success').length;
    const finalErrorCount = results.filter(r => r.status === 'error').length;
    const finalTotalEvents = results.reduce((sum, r) => sum + r.events, 0);
    
    console.log(`🎉 Sync completed! Processed ${syncableListings.length} listings in ${totalBatches} batches.`);
    console.log(`📊 Final results: ${finalSuccessCount} successful, ${finalErrorCount} failed, ${finalTotalEvents} total events processed`);
    
    return progress;
  } catch (error) {
    console.error('Error in syncAllListings:', error);
    throw error;
  }
}

/**
 * Sync a single listing by calling the sync-listing API
 */
export async function syncSingleListing(listingId: string): Promise<SyncResult> {
  try {
    const response = await fetch('/api/sync-listing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ listingId })
    });
    
    const data = await response.json();
    
    if (data.success && data.result) {
      return {
        ...data.result,
        reportId: data.reportId,
        sessionId: data.sessionId
      };
    } else {
      throw new Error(data.error || 'Failed to sync listing');
    }
  } catch (error) {
    console.error('Error syncing single listing:', error);
    throw error;
  }
} 