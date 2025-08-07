import { NextResponse } from 'next/server';
import { getRecentSyncReports, getSyncStatistics } from '@/lib/sync-reporting';

// GET /api/sync-reports - Get recent sync reports and statistics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const days = parseInt(searchParams.get('days') || '30');
    const type = searchParams.get('type'); // 'single' or 'all'
    
    // Get recent sync reports
    const reports = await getRecentSyncReports(limit);
    
    // Filter by sync type if specified
    const filteredReports = type ? reports.filter(report => report.sync_type === type) : reports;
    
    // Get sync statistics
    const statistics = await getSyncStatistics(days);
    
    return NextResponse.json({
      success: true,
      data: {
        reports: filteredReports,
        statistics,
        meta: {
          total: filteredReports.length,
          limit,
          days,
          type
        }
      }
    });
  } catch (error) {
    console.error('Error fetching sync reports:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 