import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PaymentReportStatus } from '@/lib/payment-reports';

// Helper function to send notification
async function sendNotification(cleanerUuid: string, message: string) {
  try {
    await supabase
      .from('notifications')
      .insert({
        cleaner_uuid: cleanerUuid,
        message,
        type: 'payment_status',
        read: false
      });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// GET /api/payment-reports/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // First get the report
    const { data: report, error: reportError } = await supabase
      .from('cleaner_payment_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError) throw reportError;
    
    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Report not found'
      }, { status: 404 });
    }

    // Then get all extra info for this report
    const { data: extraInfo, error: extraError } = await supabase
      .from('cleaner_extra_reports')
      .select('*')
      .eq('cleaner_uuid', report.cleaner_uuid)
      .eq('week_start_date', report.week_start)
      .order('created_at', { ascending: true });

    if (extraError) {
      console.error('Error fetching extra info:', extraError);
      throw extraError;
    }

    // Return combined data
    return NextResponse.json({
      success: true,
      report: {
        ...report,
        extra_info: extraInfo || []
      }
    });
  } catch (error) {
    console.error('Error fetching payment report:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// PATCH /api/payment-reports/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, message } = await request.json();

    // Validate status
    if (!status || !['approved', 'paid', 'rejected'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // Get current report
    const { data: report, error: fetchError } = await supabase
      .from('cleaner_payment_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    // Validate status transitions
    if (report.status === 'paid' && status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Cannot change status from paid' },
        { status: 400 }
      );
    }

    // If status is rejected, message is required
    if (status === 'rejected' && !message) {
      return NextResponse.json(
        { success: false, error: 'Message is required for rejection' },
        { status: 400 }
      );
    }

    // Update report
    const { data: updatedReport, error: updateError } = await supabase
      .from('cleaner_payment_reports')
      .update({
        status,
        rejection_message: status === 'rejected' ? message : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment report:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Send notification to cleaner
    if (status === 'approved') {
      await supabase.from('notifications').insert({
        cleaner_uuid: report.cleaner_uuid,
        message: 'Your payment report has been approved and is ready for payment.',
        type: 'payment_report_approved'
      });
    } else if (status === 'paid') {
      await supabase.from('notifications').insert({
        cleaner_uuid: report.cleaner_uuid,
        message: 'Your payment has been processed and should be received shortly.',
        type: 'payment_report_paid'
      });
    } else if (status === 'rejected') {
      await supabase.from('notifications').insert({
        cleaner_uuid: report.cleaner_uuid,
        message: `Your payment report needs revision: ${message}`,
        type: 'payment_report_rejected'
      });
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (error) {
    console.error('Error updating payment report status:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 