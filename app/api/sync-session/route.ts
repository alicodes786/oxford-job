import { NextRequest, NextResponse } from 'next/server';
import { SyncDatabaseLogger } from '@/lib/sync-database-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { syncType, totalListings, listingName, listingId, triggeredBy = 'manual' } = body;

    if (!syncType || (syncType !== 'single' && syncType !== 'all')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid syncType. Must be "single" or "all"'
      }, { status: 400 });
    }

    const logger = new SyncDatabaseLogger();
    
    let sessionId: string;
    
    if (syncType === 'all') {
      if (!totalListings || totalListings <= 0) {
        return NextResponse.json({
          success: false,
          error: 'totalListings is required for "all" sync type'
        }, { status: 400 });
      }
      
      sessionId = await logger.createSession({
        sync_type: 'all',
        total_listings: totalListings,
        triggered_by: triggeredBy
      });
    } else {
      if (!listingName) {
        return NextResponse.json({
          success: false,
          error: 'listingName is required for "single" sync type'
        }, { status: 400 });
      }
      
      sessionId = await logger.createSession({
        sync_type: 'single',
        target_listing_name: listingName,
        target_listing_id: listingId,
        total_listings: 1,
        triggered_by: triggeredBy
      });
    }
    
    await logger.startSession();

    return NextResponse.json({
      success: true,
      sessionId
    });

  } catch (error) {
    console.error('Error creating sync session:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sync session'
    }, { status: 500 });
  }
} 