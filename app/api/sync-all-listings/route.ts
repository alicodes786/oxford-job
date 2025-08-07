import { NextResponse } from 'next/server';
import { getListings } from '@/lib/models';
import { SyncDatabaseLogger } from '@/lib/sync-database-logger';

export async function POST(request: Request) {
  let dbLogger: SyncDatabaseLogger | null = null;
  
  try {
    // Extract base URL for API calls
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const apiBaseUrl = `${protocol}://${host}`;
    
    // Get request body to check sync source
    const body = await request.json();
    const triggeredBy = body.source === 'cron' ? 'automatic' : 'manual';
    
    // Get all listings
    const listings = await getListings();
    
    if (!listings || listings.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No listings found'
      }, { status: 404 });
    }
    
    // Filter out manual listings (those with external_id starting with 'manual-')
    const syncableListings = listings.filter(listing => 
      !listing.external_id?.startsWith('manual-')
    );
    
    console.log(`Starting sync for ${syncableListings.length} syncable listings (filtered out ${listings.length - syncableListings.length} manual listings)`);
    
    // Create database session for all listings sync
    dbLogger = new SyncDatabaseLogger();
    const sessionId = await dbLogger.createSession({
      sync_type: 'all',
      triggered_by: triggeredBy,
      metadata: {
        apiBaseUrl,
        totalListings: syncableListings.length
      }
    });
    
    console.log(`Created sync session: ${sessionId}`);
    
    // Start the session
    await dbLogger.startSession();
    
    const results = [];
    let totalStats = {
      total_events_processed: 0,
      total_feeds_processed: 0,
      total_added: 0,
      total_updated: 0,
      total_deactivated: 0,
      total_replaced: 0,
      total_unchanged: 0,
      total_errors: 0
    };
    
    // Process listings in batches of 5 to avoid timeouts
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < syncableListings.length; i += BATCH_SIZE) {
      batches.push(syncableListings.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      // Process each batch
      const batchPromises = batch.map(async (listing) => {
        try {
          console.log(`Processing listing: ${listing.name} (${listing.id})`);
          
          // Call the sync-listing endpoint but pass the session ID to group under "All"
          const response = await fetch(`${apiBaseUrl}/api/sync-listing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              listingId: listing.id,
              sessionId, // Pass the session ID to group under "All"
              syncType: 'all' // Explicitly mark as part of "All" sync
            })
          });
          
          const syncResult = await response.json();
          
          if (syncResult.success && syncResult.result) {
            const result = syncResult.result;
            
            // Update total stats
            totalStats.total_events_processed += result.events || 0;
            totalStats.total_feeds_processed += result.feedsProcessed || 0;
            totalStats.total_added += result.added || 0;
            totalStats.total_updated += result.updated || 0;
            totalStats.total_deactivated += result.deactivated || 0;
            totalStats.total_replaced += result.replaced || 0;
            totalStats.total_unchanged += result.unchanged || 0;
            totalStats.total_errors += result.errors || 0;
            
            return {
              listingId: listing.id,
              listingName: listing.name,
              status: 'success',
              ...result
            };
          } else {
            totalStats.total_errors += 1;
            return {
              listingId: listing.id,
              listingName: listing.name,
              status: 'error',
              errorMessage: syncResult.error || 'Unknown error',
              events: 0,
              added: 0,
              updated: 0,
              deactivated: 0,
              replaced: 0,
              unchanged: 0,
              errors: 1
            };
          }
        } catch (error) {
          console.error(`Error syncing listing ${listing.name}:`, error);
          totalStats.total_errors += 1;
          return {
            listingId: listing.id,
            listingName: listing.name,
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            events: 0,
            added: 0,
            updated: 0,
            deactivated: 0,
            replaced: 0,
            unchanged: 0,
            errors: 1
          };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update session with progress after each batch
      await dbLogger.updateSession({
        total_listings: syncableListings.length,
        completed_listings: results.length,
        ...totalStats
      });
    }
    
    // Determine overall sync status
    const hasErrors = results.some(r => r.status === 'error');
    const allFailed = results.every(r => r.status === 'error');
    
    let sessionStatus: 'completed' | 'error' | 'partial' = 'completed';
    if (allFailed) {
      sessionStatus = 'error';
    } else if (hasErrors) {
      sessionStatus = 'partial';
    }
    
    // Complete database session
    await dbLogger.completeSession(
      totalStats,
      sessionStatus,
      hasErrors ? `${results.filter(r => r.status === 'error').length} out of ${results.length} listings failed` : undefined
    );
    
    console.log(`Sync completed for all listings. Session: ${sessionId}`);
    console.log(`Summary: ${totalStats.total_events_processed} events, ${totalStats.total_added} added, ${totalStats.total_updated} updated, ${totalStats.total_errors} errors`);
    
    return NextResponse.json({
      success: !allFailed,
      message: allFailed 
        ? 'All listings failed to sync' 
        : hasErrors 
          ? 'Some listings synced successfully, some failed'
          : 'All listings synchronized successfully',
      sessionId,
      results,
      totalStats,
      summary: {
        totalListings: syncableListings.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        totalEvents: totalStats.total_events_processed,
        totalAdded: totalStats.total_added,
        totalUpdated: totalStats.total_updated,
        totalErrors: totalStats.total_errors
      }
    });
    
  } catch (error) {
    console.error('Error syncing all listings:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Handle database session error
    if (dbLogger) {
      try {
        await dbLogger.handleError(error instanceof Error ? error : new Error(errorMessage));
      } catch (dbError) {
        console.error('Failed to update database session with error:', dbError);
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      sessionId: dbLogger?.getSessionId()
    }, { status: 500 });
  }
} 