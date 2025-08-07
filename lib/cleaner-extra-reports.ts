import { supabase } from './supabase';
import { format } from 'date-fns';

export interface CleanerExtraReport {
  id: string;
  cleaner_uuid: string;
  week_start_date: string;
  travel_minutes: number;
  extra_hours: number;
  listing_id: string | null;  // Added for listing-based extra hours
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CleanerExtraReportInput {
  cleaner_uuid: string;
  week_start_date: string;
  travel_minutes: number;
  extra_hours: number;
  listing_id?: string | null;  // Added for listing-based extra hours
  notes?: string;
}

export interface CleanerExtraReportFilters {
  cleaner_uuid?: string;
  week_start_date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// Helper function to calculate Monday-Sunday boundaries for any date
function getWeekBoundaries(date: Date) {
  const day = new Date(date);
  const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday (first day of week)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(day);
  monday.setDate(day.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  // Calculate Sunday (last day of week)
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
}

// Create a new cleaner extra report
export async function upsertCleanerExtraReport(data: CleanerExtraReportInput): Promise<CleanerExtraReport> {
  console.log('Creating new cleaner extra report:', data);
  
  // Validate input
  if (data.travel_minutes < 0) {
    throw new Error('Travel minutes cannot be negative');
  }
  
  if (data.extra_hours < 0) {
    throw new Error('Extra hours cannot be negative');
  }

  // Always create a new report - no need to check for existing ones
  const { data: newReport, error: insertError } = await supabase
    .from('cleaner_extra_reports')
    .insert({
      cleaner_uuid: data.cleaner_uuid,
      week_start_date: data.week_start_date,
      travel_minutes: data.travel_minutes,
      extra_hours: data.extra_hours,
      listing_id: data.listing_id || null,
      notes: data.notes || null
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating extra report:', insertError);
    throw insertError;
  }
  
  console.log('Created new extra report:', newReport);
  return newReport;
}

// Get specific cleaner extra report (updated to handle listing_id)
export async function getCleanerExtraReport(cleanerUuid: string, weekStartDate: string, listingId?: string | null): Promise<CleanerExtraReport | null> {
  let query = supabase
    .from('cleaner_extra_reports')
    .select('*')
    .eq('cleaner_uuid', cleanerUuid)
    .eq('week_start_date', weekStartDate);

  // If listingId is provided, filter by it; otherwise get reports with null listing_id
  if (listingId) {
    query = query.eq('listing_id', listingId);
  } else {
    query = query.is('listing_id', null);
  }

  const { data: report, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }

  return report || null;
}

// Get all extra reports for a cleaner and week (can return multiple if different listings)
export async function getCleanerExtraReportsForWeek(cleanerUuid: string, weekStartDate: string): Promise<CleanerExtraReport[]> {
  const { data: reports, error } = await supabase
    .from('cleaner_extra_reports')
    .select('*')
    .eq('cleaner_uuid', cleanerUuid)
    .eq('week_start_date', weekStartDate)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return reports || [];
}

// List cleaner extra reports with filters
export async function listCleanerExtraReports(filters: CleanerExtraReportFilters) {
  let query = supabase
    .from('cleaner_extra_reports')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.cleaner_uuid) {
    query = query.eq('cleaner_uuid', filters.cleaner_uuid);
  }

  if (filters.week_start_date) {
    query = query.eq('week_start_date', filters.week_start_date);
  }

  if (filters.date_from) {
    query = query.gte('week_start_date', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('week_start_date', filters.date_to);
  }

  // Apply pagination
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  query = query
    .order('week_start_date', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: reports, error, count } = await query;

  if (error) throw error;
  return { reports: reports || [], count: count || 0, page, limit };
}

// Delete a cleaner extra report
export async function deleteCleanerExtraReport(reportId: string): Promise<void> {
  const { error } = await supabase
    .from('cleaner_extra_reports')
    .delete()
    .eq('id', reportId);

  if (error) throw error;
}

// Get current week's extra report for a cleaner
export async function getCurrentWeekExtraReport(cleanerUuid: string): Promise<CleanerExtraReport | null> {
  const { monday } = getWeekBoundaries(new Date());
  const weekStartStr = format(monday, 'yyyy-MM-dd');
  
  return await getCleanerExtraReport(cleanerUuid, weekStartStr);
}

// Get extra reports for a specific cleaner with pagination
export async function getCleanerExtraReports(cleanerUuid: string, page: number = 1, limit: number = 10) {
  return await listCleanerExtraReports({
    cleaner_uuid: cleanerUuid,
    page,
    limit
  });
} 