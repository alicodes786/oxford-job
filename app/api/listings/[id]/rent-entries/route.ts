import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/listings/[id]/rent-entries
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data: rentEntries, error } = await supabase
      .from('listing_rent_entries')
      .select('*')
      .eq('listing_id', id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      rent_entries: rentEntries || []
    });
  } catch (error) {
    console.error('Error fetching rent entries:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST /api/listings/[id]/rent-entries
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Auto-calculate net rent if not provided
    let netRentPayout = body.net_rent_payout;
    if (netRentPayout === null || netRentPayout === undefined) {
      const grossRent = parseFloat(body.gross_rent) || 0;
      const expensesOut = parseFloat(body.expenses_out) || 0;
      netRentPayout = grossRent - expensesOut;
    }
    
    const { data: rentEntry, error } = await supabase
      .from('listing_rent_entries')
      .insert({
        listing_id: id,
        period_month: body.period_month,
        period_year: body.period_year,
        gross_rent: body.gross_rent || null,
        expenses_out: body.expenses_out || null,
        net_rent_payout: netRentPayout,
        notes: body.notes || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      rent_entry: rentEntry
    });
  } catch (error) {
    console.error('Error creating rent entry:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

