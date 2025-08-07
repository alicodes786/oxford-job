import { NextResponse } from 'next/server';
import { 
  upsertCleanerExtraReport, 
  listCleanerExtraReports,
  getCleanerExtraReportsForWeek
} from '@/lib/cleaner-extra-reports';

// GET /api/cleaner-extra-reports
// List cleaner extra reports with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // If both cleaner_uuid and week_start_date are provided, get reports for that specific week
    const cleanerUuid = searchParams.get('cleaner_uuid');
    const weekStartDate = searchParams.get('week_start_date');
    
    if (cleanerUuid && weekStartDate) {
      const reports = await getCleanerExtraReportsForWeek(cleanerUuid, weekStartDate);
      return NextResponse.json({
        success: true,
        reports
      });
    }
    
    // Otherwise, use the standard filtering approach
    const filters = {
      cleaner_uuid: cleanerUuid || undefined,
      week_start_date: weekStartDate || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined
    };

    const result = await listCleanerExtraReports(filters);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error listing cleaner extra reports:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST /api/cleaner-extra-reports
// Create a new cleaner extra report
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received request body:', body);
    
    // Validate required fields
    if (!body.cleaner_uuid) {
      return NextResponse.json({
        success: false,
        error: 'cleaner_uuid is required'
      }, { status: 400 });
    }
    
    if (!body.week_start_date) {
      return NextResponse.json({
        success: false,
        error: 'week_start_date is required'
      }, { status: 400 });
    }
    
    // Validate numeric fields
    const travel_minutes = parseFloat(body.travel_minutes || 0);
    const extra_hours = parseFloat(body.extra_hours || 0);
    
    if (isNaN(travel_minutes) || travel_minutes < 0) {
      return NextResponse.json({
        success: false,
        error: 'travel_minutes must be a non-negative number'
      }, { status: 400 });
    }
    
    if (isNaN(extra_hours) || extra_hours < 0) {
      return NextResponse.json({
        success: false,
        error: 'extra_hours must be a non-negative number'
      }, { status: 400 });
    }

    // Validate listing_id if extra hours are provided
    if (extra_hours > 0 && !body.listing_id) {
      return NextResponse.json({
        success: false,
        error: 'listing_id is required when extra_hours > 0'
      }, { status: 400 });
    }
    
    const reportData = {
      cleaner_uuid: body.cleaner_uuid,
      week_start_date: body.week_start_date,
      travel_minutes,
      extra_hours,
      listing_id: body.listing_id || null,
      notes: body.notes || ''
    };

    console.log('Creating report with data:', reportData);
    
    try {
      const report = await upsertCleanerExtraReport(reportData);
      console.log('Successfully created report:', report);
      
      return NextResponse.json({
        success: true,
        report
      });
    } catch (error) {
      console.error('Error in upsertCleanerExtraReport:', error);
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error('Error creating/updating cleaner extra report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 