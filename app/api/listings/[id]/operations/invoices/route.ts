import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all invoices for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    const { data: invoices, error } = await supabase
      .from('listing_operation_invoices')
      .select('*')
      .eq('listing_id', listingId)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch invoices'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoices: invoices || []
    });
  } catch (error) {
    console.error('Error in invoices GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Upload an invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.invoice_url || !body.invoice_name) {
      return NextResponse.json({
        success: false,
        error: 'invoice_url and invoice_name are required'
      }, { status: 400 });
    }

    const { data: invoice, error } = await supabase
      .from('listing_operation_invoices')
      .insert({
        listing_id: listingId,
        invoice_url: body.invoice_url,
        invoice_name: body.invoice_name,
        invoice_amount: body.invoice_amount || null,
        invoice_date: body.invoice_date || null,
        vendor_name: body.vendor_name || null,
        description: body.description || null,
        uploaded_by_name: body.uploaded_by_name || 'Admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Error uploading invoice:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to upload invoice'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoice
    });
  } catch (error) {
    console.error('Error in invoices POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

