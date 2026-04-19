import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/listings/[id]/landlord-report
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const periodMonth = searchParams.get('period_month');
    const periodYear = searchParams.get('period_year');
    
    // Get listing details
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (listingError) throw listingError;
    
    // Calculate date range for the period
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    if (periodMonth && periodYear) {
      const month = parseInt(periodMonth);
      const year = parseInt(periodYear);
      startDate = new Date(year, month - 1, 1); // First day of month
      endDate = new Date(year, month, 0); // Last day of month
    }
    
    // Get cleaning data (from cleaner_assignments)
    // NOTE: Supabase doesn't properly filter on joined table fields, so we fetch and filter after
    let cleaningQuery = supabase
      .from('cleaner_assignments')
      .select(`
        *,
        event:event_uuid(
          uuid,
          listing_id,
          listing_name,
          checkout_date,
          listing_hours
        ),
        cleaner:cleaner_uuid(
          id,
          name,
          hourly_rate
        )
      `);
    
    if (startDate && endDate) {
      cleaningQuery = cleaningQuery
        .gte('event.checkout_date', startDate.toISOString())
        .lte('event.checkout_date', endDate.toISOString());
    }
    
    const { data: cleaningData, error: cleaningError } = await cleaningQuery;
    
    if (cleaningError) {
      console.error('Error fetching cleaning data:', cleaningError);
    }
    
    // Filter by listing_id after fetching (since joined table filters don't work in Supabase)
    const filteredCleaningData = cleaningData?.filter(assignment => 
      assignment.event?.listing_id === id
    ) || [];
    
    console.log(`Found ${cleaningData?.length || 0} total assignments, ${filteredCleaningData.length} for listing ${id}`);
    
    // Get L&P payment records for this listing
    let laundryExpenses = null;
    try {
      const lpResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/laundry-calculator/payment-records`);
      const lpData = await lpResponse.json();
      
      if (lpData.success && lpData.data) {
        // Filter payment records for the selected period
        const periodRecords = lpData.data.filter((record: any) => {
          if (record.date_mode === 'month' && periodMonth && periodYear) {
            return record.month === periodMonth && record.year === periodYear.toString();
          }
          // For custom date ranges, check if they overlap with our period
          if (record.date_mode === 'custom' && startDate && endDate) {
            const recordStart = new Date(record.start_date);
            const recordEnd = new Date(record.end_date);
            return recordStart <= endDate && recordEnd >= startDate;
          }
          return false;
        });
        
        // Sum up L&P expenses for this listing across all matching records
        let totalCheckouts = 0;
        let totalLaundry = 0;
        let totalPeripheral = 0;
        
        periodRecords.forEach((record: any) => {
          if (record.payment_data && record.payment_data[listing.name]) {
            const listingData = record.payment_data[listing.name];
            totalCheckouts += listingData.checkout_count || 0;
            totalLaundry += listingData.laundry_total || 0;
            totalPeripheral += listingData.peripheral_total || 0;
          }
        });
        
        if (totalCheckouts > 0) {
          laundryExpenses = {
            checkout_count: totalCheckouts,
            laundry_total: totalLaundry,
            peripheral_total: totalPeripheral,
            grand_total: totalLaundry + totalPeripheral
          };
        }
      }
    } catch (lpError) {
      console.error('Error fetching L&P data:', lpError);
      // Continue without L&P data
    }
    
    // Calculate cleaning summary
    const cleaningSummary = {
      total_cleanings: filteredCleaningData.length,
      total_hours: 0,
      total_cost: 0,
      cleanings: [] as any[]
    };
    
    if (filteredCleaningData.length > 0) {
      filteredCleaningData.forEach((assignment: any) => {
        // Skip if no valid event or date
        if (!assignment.event || !assignment.event.checkout_date) {
          console.warn('Skipping assignment with missing event data:', assignment.uuid);
          return;
        }
        
        const hours = parseFloat(assignment.event.listing_hours) || assignment.hours || 0;
        const hourlyRate = assignment.cleaner?.hourly_rate || 15; // Default rate
        const cost = hours * hourlyRate;
        
        cleaningSummary.total_hours += hours;
        cleaningSummary.total_cost += cost;
        cleaningSummary.cleanings.push({
          date: assignment.event.checkout_date,
          cleaner_name: assignment.cleaner?.name || 'Unknown',
          hours,
          hourly_rate: hourlyRate,
          cost,
          status: assignment.is_completed ? 'completed' : 'pending'
        });
      });
    }
    
    // Get maintenance logs (from cleaner reports with issues)
    // This queries job_completions table for reports with notes/issues
    const { data: maintenanceLogs, error: maintenanceError } = await supabase
      .from('job_completions')
      .select(`
        *,
        cleaner:cleaner_uuid(id, name, hourly_rate)
      `)
      .eq('listing_name', listing.name)
      .not('missing_items_details', 'is', null)
      .neq('missing_items_details', '')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (maintenanceError) {
      console.error('Error fetching maintenance logs:', maintenanceError);
    }
    
    const formattedMaintenanceLogs = (maintenanceLogs || []).map((log: any) => ({
      date: log.created_at,
      cleaner_name: log.cleaner?.name || 'Unknown',
      issue: log.missing_items_details,
      report_id: log.id
    }));
    
    // Get rent entries for the period
    let rentQuery = supabase
      .from('listing_rent_entries')
      .select('*')
      .eq('listing_id', id);
    
    if (periodMonth && periodYear) {
      rentQuery = rentQuery
        .eq('period_month', parseInt(periodMonth))
        .eq('period_year', parseInt(periodYear));
    }
    
    const { data: rentEntries, error: rentError } = await rentQuery;
    
    if (rentError) {
      console.error('Error fetching rent entries:', rentError);
    }
    
    return NextResponse.json({
      success: true,
      report: {
        listing,
        period: {
          month: periodMonth ? parseInt(periodMonth) : null,
          year: periodYear ? parseInt(periodYear) : null
        },
        cleaning_summary: cleaningSummary,
        laundry_expenses: laundryExpenses,
        maintenance_logs: formattedMaintenanceLogs,
        rent_entries: rentEntries || []
      }
    });
  } catch (error) {
    console.error('Error generating landlord report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

