import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch operations data for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    // Fetch operations data
    const { data, error } = await supabase
      .from('listing_operations')
      .select('*')
      .eq('listing_id', listingId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching operations:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch operations data'
      }, { status: 500 });
    }

    // If no data exists, return default structure
    if (!data) {
      return NextResponse.json({
        success: true,
        operations: {
          listing_id: listingId,
          cleaner_notes: null,
          consumables: [],
          maintenance_notes: null,
          appliances: {},
          spare_key_location: null,
          key_safe_code: null,
          parking_access_code: null,
          gate_code: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          bin_collection: [],
          emergency_numbers: {},
          directions_pdf_url: null,
          directions_maps_link: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      operations: data
    });
  } catch (error) {
    console.error('Error in operations GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// PUT - Update operations data for a listing
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();

    // Check if operations record exists
    const { data: existing } = await supabase
      .from('listing_operations')
      .select('id')
      .eq('listing_id', listingId)
      .single();

    let result;

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('listing_operations')
        .update({
          cleaner_notes: body.cleaner_notes,
          consumables: body.consumables || [],
          maintenance_notes: body.maintenance_notes,
          appliances: body.appliances || {},
          spare_key_location: body.spare_key_location,
          key_safe_code: body.key_safe_code,
          parking_access_code: body.parking_access_code,
          gate_code: body.gate_code,
          emergency_contact_name: body.emergency_contact_name,
          emergency_contact_phone: body.emergency_contact_phone,
          bin_collection: body.bin_collection || [],
          emergency_numbers: body.emergency_numbers || {},
          directions_pdf_url: body.directions_pdf_url,
          directions_maps_link: body.directions_maps_link,
          updated_at: new Date().toISOString()
        })
        .eq('listing_id', listingId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('listing_operations')
        .insert({
          listing_id: listingId,
          cleaner_notes: body.cleaner_notes,
          consumables: body.consumables || [],
          maintenance_notes: body.maintenance_notes,
          appliances: body.appliances || {},
          spare_key_location: body.spare_key_location,
          key_safe_code: body.key_safe_code,
          parking_access_code: body.parking_access_code,
          gate_code: body.gate_code,
          emergency_contact_name: body.emergency_contact_name,
          emergency_contact_phone: body.emergency_contact_phone,
          bin_collection: body.bin_collection || [],
          emergency_numbers: body.emergency_numbers || {},
          directions_pdf_url: body.directions_pdf_url,
          directions_maps_link: body.directions_maps_link
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({
      success: true,
      operations: result
    });
  } catch (error) {
    console.error('Error in operations PUT:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update operations data'
    }, { status: 500 });
  }
}

