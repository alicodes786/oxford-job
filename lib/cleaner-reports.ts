import { supabase } from './supabase';

export interface JobCompletionReport {
  id: string;
  assignment_uuid: string;
  cleaner_uuid: string;
  completion_date: string;
  listing_name: string;
  cleanliness_rating: number;
  damage_question: 'Yes' | 'No' | 'Maybe';
  damage_images: string[];
  checklist_items: {
    remote_in_unit: boolean;
    iron_in_unit: boolean;
    hair_dryer_in_unit: boolean;
    new_bedding_clean: boolean;
    bathroom_clean: boolean;
    hot_water_working: boolean;
    heating_working: boolean;
    floors_cleaned_and_hoovered: boolean;
    cutlery_check: boolean;
    towels_checked: boolean;
    keys_left_in_box: boolean;
  };
  missing_items_details: string;
  post_cleaning_images: string[];
  start_time: string;
  end_time: string;
  duration_seconds: number;
  created_at: string;
  
  // Joined data
  cleaner?: {
    id: string;
    name: string;
    hourly_rate: number;
  };
  assignment?: {
    uuid: string;
    hours: number;
    event_uuid: string;
    event?: {
      uuid: string;
      listing_name: string;
      checkout_date: string;
      checkout_time: string;
      checkout_type: string;
    };
  };
  event?: {
    uuid: string;
    listing_name: string;
    checkout_date: string;
    checkout_time: string;
    checkout_type: string;
  };
}

export interface CleanerReportFilters {
  cleaner_uuid?: string | null;
  week_start?: string;
  week_end?: string;
  date_from?: string;
  date_to?: string;
  listing_name?: string;
  limit?: number;
  offset?: number;
}

// Helper function to calculate week boundaries (Monday-Sunday)
export const getWeekBoundaries = (date: Date) => {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
};

// Get job completion reports with filtering
export async function getJobCompletionReports(filters: CleanerReportFilters = {}) {
  try {
    let query = supabase
      .from('job_completions')
      .select(`
        *,
        cleaner:cleaner_uuid(id, name, hourly_rate),
        assignment:assignment_uuid(
          uuid, 
          hours, 
          event_uuid,
          event:event_uuid(
            uuid,
            listing_name,
            checkout_date,
            checkout_time,
            checkout_type
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.cleaner_uuid) {
      query = query.eq('cleaner_uuid', filters.cleaner_uuid);
    }

      if (filters.week_start && filters.week_end) {
    // Ensure we're filtering by date only (not datetime)
    query = query
      .gte('completion_date', filters.week_start)
      .lte('completion_date', filters.week_end);
  }

    if (filters.date_from) {
      query = query.gte('completion_date', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('completion_date', filters.date_to);
    }

    if (filters.listing_name) {
      query = query.ilike('listing_name', `%${filters.listing_name}%`);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching job completion reports:', error);
      throw error;
    }

    return data as JobCompletionReport[];
  } catch (error) {
    console.error('Error in getJobCompletionReports:', error);
    throw error;
  }
}

// Get a specific job completion report by ID
export async function getJobCompletionReport(id: string) {
  try {
    const { data, error } = await supabase
      .from('job_completions')
      .select(`
        *,
        cleaner:cleaner_uuid(id, name, hourly_rate),
        assignment:assignment_uuid(
          uuid, 
          hours, 
          event_uuid,
          event:event_uuid(
            uuid,
            listing_name,
            checkout_date,
            checkout_time,
            checkout_type,
            event_id
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching job completion report:', error);
      throw error;
    }

    return data as JobCompletionReport;
  } catch (error) {
    console.error('Error in getJobCompletionReport:', error);
    throw error;
  }
}

// Get job completion reports for a specific week
export async function getJobCompletionReportsForWeek(weekStartDate: Date, cleanerUuid?: string) {
  const { weekStart, weekEnd } = getWeekBoundaries(weekStartDate);
  
  return getJobCompletionReports({
    cleaner_uuid: cleanerUuid,
    week_start: weekStart.toISOString().split('T')[0],
    week_end: weekEnd.toISOString().split('T')[0],
  });
}

// Get summary statistics for job completion reports
export async function getJobCompletionStats(filters: CleanerReportFilters = {}) {
  try {
    const reports = await getJobCompletionReports(filters);
    
    const stats = {
      total_jobs: reports.length,
      average_duration: 0,
      average_rating: 0,
      damage_reports: 0,
      total_duration: 0,
      cleaners: new Set<string>(),
      listings: new Set<string>(),
    };

    if (reports.length > 0) {
      let totalDuration = 0;
      let totalRating = 0;
      let damageCount = 0;

      reports.forEach(report => {
        totalDuration += report.duration_seconds || 0;
        totalRating += report.cleanliness_rating || 0;
        if (report.damage_question === 'Yes') damageCount++;
        
        if (report.cleaner?.id) stats.cleaners.add(report.cleaner.id);
        if (report.listing_name) stats.listings.add(report.listing_name);
      });

      stats.average_duration = Math.round(totalDuration / reports.length);
      stats.average_rating = Math.round((totalRating / reports.length) * 10) / 10;
      stats.damage_reports = damageCount;
      stats.total_duration = totalDuration;
    }

    return {
      ...stats,
      unique_cleaners: stats.cleaners.size,
      unique_listings: stats.listings.size,
    };
  } catch (error) {
    console.error('Error in getJobCompletionStats:', error);
    throw error;
  }
}

// Format duration from seconds to human readable
export function formatDuration(seconds: number): string {
  if (!seconds) return '0m';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Get checklist completion percentage
export function getChecklistCompletionPercentage(checklistItems: any): number {
  if (!checklistItems) return 0;
  
  const items = Object.values(checklistItems);
  const completed = items.filter(item => item === true).length;
  
  return Math.round((completed / items.length) * 100);
} 

// Enhanced statistics functionality temporarily disabled
/*
// Get enhanced statistics for cleaners
export async function getEnhancedStats(timeframe: 'week' | 'month' = 'week') {
  try {
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    if (timeframe === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else {
      startDate.setMonth(now.getMonth() - 1);
    }

    const filters: CleanerReportFilters = {
      date_from: startDate.toISOString().split('T')[0],
      date_to: now.toISOString().split('T')[0]
    };

    // Get base stats
    const baseStats = await getJobCompletionStats(filters);
    
    // Get all reports for the period
    const reports = await getJobCompletionReports(filters);
    
    // Process reports to get required statistics
    const problematicUnits = new Map<string, {
      listing_name: string;
      jobs_count: number;
      issue_count: number;
      total_duration: number;
      recent_issues: string[];
      is_flagged: boolean;
    }>();

    const commonIssues = new Map<string, {
      count: number;
      examples: string[];
      listings: Set<string>;
    }>();

    let maintenanceNeeded = 0;
    let jobsWithNotes = 0;

    reports.forEach(report => {
      // Count maintenance needs based on damage reports
      if (report.damage_question === 'Yes') {
        maintenanceNeeded++;
      }

      // Count jobs with significant notes
      if (report.missing_items_details && report.missing_items_details.trim().length > 0) {
        jobsWithNotes++;
      }

      // Track problematic units
      if (report.event?.listing_name) {
        const listing = problematicUnits.get(report.event.listing_name) || {
          listing_name: report.event.listing_name,
          jobs_count: 0,
          issue_count: 0,
          total_duration: 0,
          recent_issues: [],
          is_flagged: false
        };

        listing.jobs_count++;
        if (report.damage_question === 'Yes' || report.cleanliness_rating < 4) {
          listing.issue_count++;
          if (report.missing_items_details) {
            listing.recent_issues.push(report.missing_items_details);
          }
        }
        listing.total_duration += report.duration_seconds || 0;
        listing.is_flagged = listing.issue_count > 2;

        problematicUnits.set(report.event.listing_name, listing);

        // Track common issues from notes
        if (report.missing_items_details) {
          const keywords = report.missing_items_details.toLowerCase()
            .split(/[.,!?\s]+/)
            .filter(word => word.length > 3);

          keywords.forEach(keyword => {
            const issue = commonIssues.get(keyword) || {
              count: 0,
              examples: [],
              listings: new Set<string>()
            };
            issue.count++;
            if (issue.examples.length < 3) {
              issue.examples.push(report.missing_items_details);
            }
            issue.listings.add(report.event.listing_name);
            commonIssues.set(keyword, issue);
          });
        }
      }
    });

    // Convert problematic units to array and sort by issue percentage
    const problematicUnitsArray = Array.from(problematicUnits.values())
      .map(unit => ({
        listing_name: unit.listing_name,
        jobs_count: unit.jobs_count,
        issue_percentage: (unit.issue_count / unit.jobs_count) * 100,
        avg_duration: Math.round(unit.total_duration / unit.jobs_count / 60), // Convert to minutes
        recent_issues: unit.recent_issues,
        is_flagged: unit.is_flagged
      }))
      .filter(unit => unit.issue_percentage > 20)
      .sort((a, b) => b.issue_percentage - a.issue_percentage)
      .slice(0, 10);

    // Convert common issues to array and sort by frequency
    const commonIssuesArray = Array.from(commonIssues.entries())
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        examples: data.examples,
        listings: Array.from(data.listings)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Generate alerts based on the data
    const alerts = [];
    if (maintenanceNeeded > 5) {
      alerts.push({
        message: 'High number of maintenance requests',
        severity: 'high' as const,
        context: `${maintenanceNeeded} properties reported maintenance needs in this period`
      });
    }

    const highIssueUnits = problematicUnitsArray.filter(unit => unit.issue_percentage > 75);
    if (highIssueUnits.length > 0) {
      alerts.push({
        message: 'Properties with recurring issues detected',
        severity: 'medium' as const,
        context: `${highIssueUnits.length} properties have reported issues in over 75% of cleanings`
      });
    }

    return {
      summary: {
        total_jobs: baseStats.total_jobs,
        avg_duration: Math.round(baseStats.average_duration / 60), // Convert to minutes
        maintenance_needed: maintenanceNeeded,
        jobs_with_notes: jobsWithNotes,
        properties_serviced: baseStats.unique_listings
      },
      problematic_units: problematicUnitsArray,
      common_issues: commonIssuesArray,
      alerts
    };
  } catch (error) {
    console.error('Error in getEnhancedStats:', error);
    throw error;
  }
}
*/ 