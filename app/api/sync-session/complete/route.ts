import { NextRequest, NextResponse } from 'next/server';
import { SyncDatabaseLogger } from '@/lib/sync-database-logger';
import type { SyncResult } from '@/lib/sync-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, results } = body;

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'sessionId is required'
      }, { status: 400 });
    }

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({
        success: false,
        error: 'results array is required'
      }, { status: 400 });
    }

    const logger = new SyncDatabaseLogger();
    logger.setSessionId(sessionId);

    // Calculate aggregate statistics from results
    const stats = results.reduce((acc: any, result: SyncResult) => {
      return {
        total_events_processed: acc.total_events_processed + (result.events || 0),
        total_feeds_processed: acc.total_feeds_processed + (result.feedsProcessed || 0),
        total_added: acc.total_added + (result.added || 0),
        total_updated: acc.total_updated + (result.updated || 0),
        total_deactivated: acc.total_deactivated + (result.deactivated || 0),
        total_replaced: acc.total_replaced + (result.replaced || 0),
        total_unchanged: acc.total_unchanged + (result.unchanged || 0),
        total_errors: acc.total_errors + (result.errors || 0)
      };
    }, {
      total_events_processed: 0,
      total_feeds_processed: 0,
      total_added: 0,
      total_updated: 0,
      total_deactivated: 0,
      total_replaced: 0,
      total_unchanged: 0,
      total_errors: 0
    });

    // Determine final status
    const hasErrors = results.some((result: SyncResult) => result.status === 'error');
    const hasSuccess = results.some((result: SyncResult) => result.status === 'success');
    
    let finalStatus: 'completed' | 'error' | 'partial' = 'completed';
    if (hasErrors && hasSuccess) {
      finalStatus = 'partial';
    } else if (hasErrors && !hasSuccess) {
      finalStatus = 'error';
    }

    // Complete the session
    await logger.completeSession(stats, finalStatus);

    // Update completed listings count
    await logger.updateSession({
      completed_listings: results.length
    });

    return NextResponse.json({
      success: true,
      sessionId,
      status: finalStatus,
      stats
    });

  } catch (error) {
    console.error('Error completing sync session:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete sync session'
    }, { status: 500 });
  }
} 