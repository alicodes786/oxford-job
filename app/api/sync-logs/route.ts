import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Filter parameters
    const syncType = searchParams.get('syncType');
    const status = searchParams.get('status');
    const listingName = searchParams.get('listingName');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Build the query
    let query = supabase
      .from('sync_sessions')
      .select(`
        id,
        created_at,
        updated_at,
        sync_type,
        triggered_by,
        target_listing_id,
        target_listing_name,
        status,
        started_at,
        completed_at,
        duration_seconds,
        total_listings,
        completed_listings,
        total_events_processed,
        total_feeds_processed,
        total_added,
        total_updated,
        total_deactivated,
        total_replaced,
        total_unchanged,
        total_errors,
        error_message,
        error_details,
        metadata
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (syncType) {
      query = query.eq('sync_type', syncType);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (listingName) {
      query = query.ilike('target_listing_name', `%${listingName}%`);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Get total count for pagination
    const { count } = await supabase
      .from('sync_sessions')
      .select('*', { count: 'exact', head: true });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: sessions, error } = await query;

    if (error) {
      console.error('Error fetching sync sessions:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sync sessions'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        sessions: sessions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in sync-logs API:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 