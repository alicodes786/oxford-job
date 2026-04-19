import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns';

// GET - Fetch damage reports for a listing (with optional week filter)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const { searchParams } = new URL(request.url);
    const weekFilter = searchParams.get('week'); // Format: YYYY-MM-DD (any day in the week)

    // Get listing name first
    const { data: listing } = await supabase
      .from('listings')
      .select('name')
      .eq('id', listingId)
      .single();

    if (!listing) {
      return NextResponse.json({
        success: false,
        error: 'Listing not found'
      }, { status: 404 });
    }

    const listingName = listing.name;

    // Build query for job completions with damage
    let query = supabase
      .from('job_completions')
      .select(`
        id,
        assignment_uuid,
        completion_date,
        listing_name,
        damage_question,
        damage_images,
        cleaner_uuid
      `)
      .eq('listing_name', listingName)
      .eq('damage_question', 'Yes')
      .order('completion_date', { ascending: false });

    // Apply week filter if provided
    if (weekFilter) {
      try {
        const weekDate = parseISO(weekFilter);
        const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 }); // Sunday
        
        query = query
          .gte('completion_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('completion_date', format(weekEnd, 'yyyy-MM-dd'));
      } catch (error) {
        console.error('Invalid week filter date:', weekFilter);
      }
    }

    const { data: damageReports, error } = await query;

    if (error) {
      console.error('Error fetching damage reports:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch damage reports'
      }, { status: 500 });
    }

    // Get cleaner names for each report
    const cleanerUuids = [...new Set(damageReports?.map(r => r.cleaner_uuid).filter(Boolean))];
    
    let cleaners: any[] = [];
    if (cleanerUuids.length > 0) {
      const { data: cleanersData } = await supabase
        .from('cleaners')
        .select('id, name')
        .in('id', cleanerUuids);
      
      cleaners = cleanersData || [];
    }

    // Map cleaner names to reports
    const reportsWithCleanerNames = damageReports?.map(report => ({
      id: report.id,
      listing_name: report.listing_name,
      completion_date: report.completion_date,
      damage_question: report.damage_question,
      damage_images: report.damage_images || [],
      cleaner_name: cleaners.find(c => c.id === report.cleaner_uuid)?.name || 'Unknown',
      assignment_uuid: report.assignment_uuid
    })) || [];

    return NextResponse.json({
      success: true,
      reports: reportsWithCleanerNames
    });
  } catch (error) {
    console.error('Error in damage reports GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

