import { NextRequest, NextResponse } from 'next/server';
import { getJobCompletionReports, getJobCompletionStats, CleanerReportFilters } from '@/lib/cleaner-reports';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Build filters from query parameters
    const filters: CleanerReportFilters = {};
    
    if (searchParams.get('cleaner_uuid')) {
      filters.cleaner_uuid = searchParams.get('cleaner_uuid');
    }
    
    if (searchParams.get('week_start')) {
      filters.week_start = searchParams.get('week_start')!;
    }
    
    if (searchParams.get('week_end')) {
      filters.week_end = searchParams.get('week_end')!;
    }
    
    // If week_start is provided but not week_end, calculate week_end
    if (filters.week_start && !filters.week_end) {
      const weekStartDate = new Date(filters.week_start);
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      filters.week_end = weekEndDate.toISOString().split('T')[0];
    }
    
    if (searchParams.get('date_from')) {
      filters.date_from = searchParams.get('date_from')!;
    }
    
    if (searchParams.get('date_to')) {
      filters.date_to = searchParams.get('date_to')!;
    }
    
    if (searchParams.get('listing_name')) {
      filters.listing_name = searchParams.get('listing_name')!;
    }
    
    if (searchParams.get('limit')) {
      filters.limit = parseInt(searchParams.get('limit')!);
    }
    
    if (searchParams.get('offset')) {
      filters.offset = parseInt(searchParams.get('offset')!);
    }

    // Check if requesting stats only
    const statsOnly = searchParams.get('stats_only') === 'true';
    
    if (statsOnly) {
      const stats = await getJobCompletionStats(filters);
      return NextResponse.json({
        success: true,
        stats
      });
    }

    // Get the reports
    const reports = await getJobCompletionReports(filters);
    
    // Also get stats for summary
    const stats = await getJobCompletionStats(filters);

    return NextResponse.json({
      success: true,
      reports,
      stats,
      count: reports.length
    });

  } catch (error) {
    console.error('Error in cleaner-reports API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 