import { NextResponse } from 'next/server';
import { 
  getCleanerExtraReport,
  deleteCleanerExtraReport
} from '@/lib/cleaner-extra-reports';
import { supabase } from '@/lib/supabase';

// GET /api/cleaner-extra-reports/[id]
// Get a specific cleaner extra report by cleaner_uuid and week_start_date
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // For this endpoint, we expect the id to be cleaner_uuid and week_start_date as query param
    const cleanerUuid = id;
    const weekStartDate = searchParams.get('week_start_date');
    const listingId = searchParams.get('listing_id');
    
    if (!weekStartDate) {
      return NextResponse.json({
        success: false,
        error: 'week_start_date query parameter is required'
      }, { status: 400 });
    }
    
    const report = await getCleanerExtraReport(cleanerUuid, weekStartDate, listingId);
    
    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Report not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error fetching cleaner extra report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// DELETE /api/cleaner-extra-reports/[id]
// Delete a specific cleaner extra report by id
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // For DELETE, id is the actual report ID
    const { error } = await supabase
      .from('cleaner_extra_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting cleaner extra report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 

// PATCH /api/cleaner-extra-reports/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.extra_hours || body.extra_hours <= 0) {
      return NextResponse.json({
        success: false,
        error: 'extra_hours must be a positive number'
      }, { status: 400 });
    }

    // Validate listing_id if extra hours are provided
    if (body.extra_hours > 0 && !body.listing_id) {
      return NextResponse.json({
        success: false,
        error: 'listing_id is required when extra_hours > 0'
      }, { status: 400 });
    }

    // Update the report
    const { data: report, error } = await supabase
      .from('cleaner_extra_reports')
      .update({
        extra_hours: body.extra_hours,
        listing_id: body.listing_id,
        notes: body.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error updating cleaner extra report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 