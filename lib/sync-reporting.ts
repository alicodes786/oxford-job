import { supabase } from './supabase';
import { SyncLogEntry } from './sync-logging';

export interface SyncReportData {
  listingId?: string;
  listingName?: string;
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
  notificationsSent?: number;
  detailedLogs?: SyncLogEntry[];
}

export interface SyncConfig {
  apiBaseUrl?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  batchSize?: number;
  activeOnly?: boolean;
}

// Create a new sync report entry
export async function createSyncReport(
  syncType: 'single' | 'all',
  config?: SyncConfig,
  listingId?: string,
  listingName?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('sync_reports')
      .insert({
        sync_type: syncType,
        status: 'success', // Will be updated later
        listing_id: listingId,
        listing_name: listingName,
        sync_config: config || {}
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating sync report:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error creating sync report:', error);
    return null;
  }
}

// Update sync report with completion data
export async function completeSyncReport(
  reportId: string,
  results: SyncReportData | SyncReportData[],
  status: 'success' | 'error' | 'partial' = 'success',
  errorMessage?: string,
  errorDetails?: any
): Promise<boolean> {
  try {
    const startTime = Date.now();
    
    // Calculate summary statistics
    let summary: {
      listings_processed: number;
      feeds_processed: number;
      events_total: number;
      events_added: number;
      events_updated: number;
      events_deactivated: number;
      events_replaced: number;
      events_unchanged: number;
      events_errors: number;
      notifications_sent: number;
    };

    if (Array.isArray(results)) {
      // Multiple listing results (sync all)
      summary = {
        listings_processed: results.length,
        feeds_processed: results.reduce((sum, r) => sum + r.feedsProcessed, 0),
        events_total: results.reduce((sum, r) => sum + r.events, 0),
        events_added: results.reduce((sum, r) => sum + r.added, 0),
        events_updated: results.reduce((sum, r) => sum + r.updated, 0),
        events_deactivated: results.reduce((sum, r) => sum + r.deactivated, 0),
        events_replaced: results.reduce((sum, r) => sum + r.replaced, 0),
        events_unchanged: results.reduce((sum, r) => sum + r.unchanged, 0),
        events_errors: results.reduce((sum, r) => sum + r.errors, 0),
        notifications_sent: results.reduce((sum, r) => sum + (r.notificationsSent || 0), 0)
      };
    } else {
      // Single listing result
      summary = {
        listings_processed: 1,
        feeds_processed: results.feedsProcessed,
        events_total: results.events,
        events_added: results.added,
        events_updated: results.updated,
        events_deactivated: results.deactivated,
        events_replaced: results.replaced,
        events_unchanged: results.unchanged,
        events_errors: results.errors,
        notifications_sent: results.notificationsSent || 0
      };
    }

    // Get the original start time from the report
    const { data: originalReport } = await supabase
      .from('sync_reports')
      .select('started_at')
      .eq('id', reportId)
      .single();

    const completedAt = new Date();
    const durationMs = originalReport ? 
      completedAt.getTime() - new Date(originalReport.started_at).getTime() : 
      null;

    const updateData = {
      status,
      completed_at: completedAt.toISOString(),
      duration_ms: durationMs,
      ...summary,
      results_data: results,
      error_message: errorMessage,
      error_details: errorDetails
    };

    const { error } = await supabase
      .from('sync_reports')
      .update(updateData)
      .eq('id', reportId);

    if (error) {
      console.error('Error updating sync report:', error);
      return false;
    }

    console.log(`Sync report ${reportId} completed successfully`);
    return true;
  } catch (error) {
    console.error('Error completing sync report:', error);
    return false;
  }
}

// Get recent sync reports
export async function getRecentSyncReports(limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('sync_reports')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching sync reports:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching sync reports:', error);
    return [];
  }
}

// Get sync statistics
export async function getSyncStatistics(days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .rpc('get_sync_statistics', {
        start_date: startDate.toISOString(),
        end_date: new Date().toISOString()
      });

    if (error) {
      console.error('Error fetching sync statistics:', error);
      return null;
    }

    return data[0] || null;
  } catch (error) {
    console.error('Error fetching sync statistics:', error);
    return null;
  }
} 