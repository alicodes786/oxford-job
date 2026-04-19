import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE - Delete an invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { invoiceId } = await params;

    const { error } = await supabase
      .from('listing_operation_invoices')
      .delete()
      .eq('id', invoiceId);

    if (error) {
      console.error('Error deleting invoice:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete invoice'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error in invoice DELETE:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

