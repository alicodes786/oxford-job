import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT /api/listings/[id]/rent-entries/[eid]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const { eid } = await params;
    const body = await request.json();
    
    const updateData: any = {};
    if (body.period_month !== undefined) updateData.period_month = body.period_month;
    if (body.period_year !== undefined) updateData.period_year = body.period_year;
    if (body.gross_rent !== undefined) updateData.gross_rent = body.gross_rent;
    if (body.expenses_out !== undefined) updateData.expenses_out = body.expenses_out;
    if (body.notes !== undefined) updateData.notes = body.notes;
    
    // Auto-calculate net rent if gross or expenses changed
    if (body.gross_rent !== undefined || body.expenses_out !== undefined) {
      const grossRent = parseFloat(body.gross_rent) || 0;
      const expensesOut = parseFloat(body.expenses_out) || 0;
      updateData.net_rent_payout = grossRent - expensesOut;
    } else if (body.net_rent_payout !== undefined) {
      updateData.net_rent_payout = body.net_rent_payout;
    }
    
    const { data: rentEntry, error } = await supabase
      .from('listing_rent_entries')
      .update(updateData)
      .eq('id', eid)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      rent_entry: rentEntry
    });
  } catch (error) {
    console.error('Error updating rent entry:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// DELETE /api/listings/[id]/rent-entries/[eid]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const { eid } = await params;
    
    const { error } = await supabase
      .from('listing_rent_entries')
      .delete()
      .eq('id', eid);
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting rent entry:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

