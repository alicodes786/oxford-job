import { supabase } from '@/lib/supabase';
import type { SyncLogEntry } from './sync-logging';

export interface SyncSession {
  id?: string;
  sync_type: 'single' | 'all';
  triggered_by?: string;
  target_listing_id?: string;
  target_listing_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error' | 'partial';
  started_at?: string;
  completed_at?: string;
  total_listings?: number;
  completed_listings?: number;
  total_events_processed?: number;
  total_feeds_processed?: number;
  total_added?: number;
  total_updated?: number;
  total_deactivated?: number;
  total_replaced?: number;
  total_unchanged?: number;
  total_errors?: number;
  error_message?: string;
  error_details?: any;
  metadata?: any;
  duration_seconds?: number;
}

export class SyncDatabaseLogger {
  private sessionId: string | null = null;
  
  /**
   * Create a new sync session in the database
   */
  async createSession(sessionData: Omit<SyncSession, 'id' | 'status'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('sync_sessions')
        .insert({
          ...sessionData,
          status: 'pending' as const,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Failed to create sync session:', error);
        throw error;
      }
      
      this.sessionId = data.id;
      return data.id;
    } catch (error) {
      console.error('Error creating sync session:', error);
      throw error;
    }
  }
  
  /**
   * Update sync session status and statistics
   */
  async updateSession(updates: Partial<SyncSession>): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active sync session. Call createSession first.');
    }
    
    try {
      const updateData: any = { ...updates };
      
      // Set completed_at if status is being set to a final state
      if (updates.status && ['completed', 'error', 'partial'].includes(updates.status)) {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('sync_sessions')
        .update(updateData)
        .eq('id', this.sessionId);
      
      if (error) {
        console.error('Failed to update sync session:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating sync session:', error);
      throw error;
    }
  }
  
  /**
   * Mark session as started
   */
  async startSession(): Promise<void> {
    await this.updateSession({
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
  }
  
  /**
   * Complete the session with final statistics
   */
  async completeSession(stats: {
    total_events_processed: number;
    total_feeds_processed: number;
    total_added: number;
    total_updated: number;
    total_deactivated: number;
    total_replaced: number;
    total_unchanged: number;
    total_errors: number;
  }, status: 'completed' | 'error' | 'partial' = 'completed', errorMessage?: string): Promise<void> {
    // Get the session to calculate duration
    const { data: session } = await supabase
      .from('sync_sessions')
      .select('started_at')
      .eq('id', this.sessionId)
      .single();

    const completedAt = new Date();
    const startedAt = session?.started_at ? new Date(session.started_at) : completedAt;
    const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);

    await this.updateSession({
      ...stats,
      status,
      error_message: errorMessage,
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds
    });
  }
  
  /**
   * Save log entries from SyncLogger to database
   */
  async saveLogEntries(logs: SyncLogEntry[]): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active sync session. Call createSession first.');
    }
    
    if (logs.length === 0) {
      return;
    }
    
    try {
      const logEntries = logs.map(log => ({
        sync_session_id: this.sessionId,
        operation: log.operation,
        event_id: log.eventId,
        listing_name: log.listingName,
        event_details: log.eventDetails,
        reasoning: log.reasoning,
        metadata: log.metadata || {},
        created_at: log.timestamp
      }));
      
      const { error } = await supabase
        .from('sync_log_entries')
        .insert(logEntries);
      
      if (error) {
        console.error('Failed to save log entries:', error);
        throw error;
      }
      
      console.log(`✓ Saved ${logEntries.length} log entries to database`);
    } catch (error) {
      console.error('Error saving log entries:', error);
      throw error;
    }
  }
  
  /**
   * Get the current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }
  
  /**
   * Set the session ID (useful when resuming an existing session)
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
  
  /**
   * Handle errors during sync and update session accordingly
   */
  async handleError(error: Error, additionalDetails?: any): Promise<void> {
    await this.updateSession({
      status: 'error',
      error_message: error.message,
      error_details: {
        stack: error.stack,
        ...additionalDetails
      }
    });
  }
  
  /**
   * Increment session statistics (useful for real-time updates)
   */
  async incrementStats(stats: Partial<{
    total_events_processed: number;
    total_feeds_processed: number;
    total_added: number;
    total_updated: number;
    total_deactivated: number;
    total_replaced: number;
    total_unchanged: number;
    total_errors: number;
  }>): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active sync session. Call createSession first.');
    }
    
    try {
      // Get current stats
      const { data: currentSession, error: fetchError } = await supabase
        .from('sync_sessions')
        .select('total_events_processed, total_feeds_processed, total_added, total_updated, total_deactivated, total_replaced, total_unchanged, total_errors')
        .eq('id', this.sessionId)
        .single();
      
      if (fetchError) {
        throw fetchError;
      }
      
      // Calculate new stats by adding increments
      const newStats = {
        total_events_processed: (currentSession.total_events_processed || 0) + (stats.total_events_processed || 0),
        total_feeds_processed: (currentSession.total_feeds_processed || 0) + (stats.total_feeds_processed || 0),
        total_added: (currentSession.total_added || 0) + (stats.total_added || 0),
        total_updated: (currentSession.total_updated || 0) + (stats.total_updated || 0),
        total_deactivated: (currentSession.total_deactivated || 0) + (stats.total_deactivated || 0),
        total_replaced: (currentSession.total_replaced || 0) + (stats.total_replaced || 0),
        total_unchanged: (currentSession.total_unchanged || 0) + (stats.total_unchanged || 0),
        total_errors: (currentSession.total_errors || 0) + (stats.total_errors || 0)
      };
      
      await this.updateSession(newStats);
    } catch (error) {
      console.error('Error incrementing session stats:', error);
      throw error;
    }
  }
} 