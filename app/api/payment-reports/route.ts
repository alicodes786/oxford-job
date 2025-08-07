import { NextResponse } from 'next/server';
import { 
  generateWeeklyReport, 
  getPaymentReport, 
  listPaymentReports, 
  cleanupDuplicateReports,
  getDuplicateReportsSummary
} from '@/lib/payment-reports';

// GET /api/payment-reports
// List payment reports with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      cleaner_uuid: searchParams.get('cleaner_uuid') || undefined,
      status: searchParams.get('status') || undefined,
      date_from: searchParams.get('date_from') ? new Date(searchParams.get('date_from')!) : undefined,
      date_to: searchParams.get('date_to') ? new Date(searchParams.get('date_to')!) : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    };

    const result = await listPaymentReports(filters);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error listing payment reports:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST /api/payment-reports
// Generate a new payment report
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Handle the new approach: let server calculate current week
    let weekStart: Date;
    
    if (body.use_current_week) {
      // Calculate current week on server (avoids timezone issues)
      weekStart = new Date();
      console.log('Server current time:', weekStart.toISOString());
      console.log('Server current time local:', weekStart.toLocaleDateString());
    } else if (body.week_start) {
      // Fallback: use provided week_start
      // Parse as local date to avoid timezone issues
      if (body.week_start.includes('T')) {
        // If it's an ISO string, parse normally
        weekStart = new Date(body.week_start);
      } else {
        // If it's YYYY-MM-DD format, parse as local date
        const [year, month, day] = body.week_start.split('-').map(Number);
        weekStart = new Date(year, month - 1, day); // month is 0-indexed
      }
    } else {
      // Default: use current week
      weekStart = new Date();
    }
    
    const reports = await generateWeeklyReport(
      body.cleaner_uuid || null,
      weekStart
    );
    
    return NextResponse.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('Error generating payment report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// PATCH /api/payment-reports
// Handle cleanup operations
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'cleanup-duplicates') {
      const result = await cleanupDuplicateReports();
      return NextResponse.json({
        success: true,
        ...result
      });
    }
    
    if (action === 'get-duplicates-summary') {
      const result = await getDuplicateReportsSummary();
      return NextResponse.json({
        success: true,
        ...result
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Error in cleanup operation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 