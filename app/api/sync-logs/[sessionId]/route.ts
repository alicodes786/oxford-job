import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters for log entries
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const operation = searchParams.get('operation');
    const listingName = searchParams.get('listingName');

    // First, get the sync session details
    const { data: session, error: sessionError } = await supabase
      .from('sync_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({
        success: false,
        error: 'Sync session not found'
      }, { status: 404 });
    }

    // Build query for log entries
    let logQuery = supabase
      .from('sync_log_entries')
      .select(`
        id,
        created_at,
        operation,
        event_id,
        listing_name,
        event_details,
        reasoning,
        metadata
      `)
      .eq('sync_session_id', sessionId)
      .order('created_at', { ascending: true });

    // Apply filters
    if (operation) {
      logQuery = logQuery.eq('operation', operation);
    }
    
    if (listingName) {
      logQuery = logQuery.ilike('listing_name', `%${listingName}%`);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('sync_log_entries')
      .select('*', { count: 'exact', head: true })
      .eq('sync_session_id', sessionId);

    // Apply pagination
    logQuery = logQuery.range(offset, offset + limit - 1);
    
    const { data: logEntries, error: logError } = await logQuery;

    if (logError) {
      console.error('Error fetching sync log entries:', logError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sync log entries'
      }, { status: 500 });
    }

    // Get operation summary for the session
    const { data: operationSummary } = await supabase
      .from('sync_log_entries')
      .select('operation')
      .eq('sync_session_id', sessionId);

    const operationCounts = operationSummary?.reduce((acc, entry) => {
      acc[entry.operation] = (acc[entry.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      success: true,
      data: {
        session,
        logEntries: logEntries || [],
        operationCounts,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in sync-logs session API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 