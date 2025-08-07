import { NextResponse } from 'next/server';
import { calculateReportDataWithExtraHours } from '@/lib/payment-reports';
import { getCleanerAssignmentsForWeek } from '@/lib/payment-reports';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

// POST /api/payment-reports/update-extra-hours
// Auto-update payment report totals when extra hours are submitted
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cleaner_uuid, week_start_date } = body;
    
    if (!cleaner_uuid || !week_start_date) {
      return NextResponse.json({
        success: false,
        error: 'cleaner_uuid and week_start_date are required'
      }, { status: 400 });
    }

    // Find existing payment report for this cleaner and week
    const weekStartDate = new Date(week_start_date);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const { data: existingReport, error: findError } = await supabase
      .from('cleaner_payment_reports')
      .select('*, cleaners!inner(hourly_rate)')
      .eq('cleaner_uuid', cleaner_uuid)
      .eq('week_start', format(weekStartDate, 'yyyy-MM-dd'))
      .eq('week_end', format(weekEndDate, 'yyyy-MM-dd'))
      .single();

    if (findError || !existingReport) {
      console.log('No existing payment report found for auto-update');
      return NextResponse.json({
        success: true,
        message: 'No payment report to update'
      });
    }

    // Get assignments for this week
    const assignments = await getCleanerAssignmentsForWeek(
      cleaner_uuid, 
      weekStartDate, 
      weekEndDate
    );

    // Recalculate report data with extra hours
    const updatedReportData = await calculateReportDataWithExtraHours(
      assignments, 
      existingReport.cleaners.hourly_rate, 
      cleaner_uuid, 
      week_start_date
    );

    // Update the payment report with new totals
    const { error: updateError } = await supabase
      .from('cleaner_payment_reports')
      .update({
        total_hours: updatedReportData.summary.total_hours,
        total_amount: updatedReportData.summary.total_amount,
        report_data: updatedReportData,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingReport.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`Auto-updated payment report for cleaner ${cleaner_uuid}, week ${week_start_date}`);

    return NextResponse.json({
      success: true,
      message: 'Payment report updated successfully',
      updated_totals: {
        total_hours: updatedReportData.summary.total_hours,
        total_amount: updatedReportData.summary.total_amount
      }
    });

  } catch (error) {
    console.error('Error auto-updating payment report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 