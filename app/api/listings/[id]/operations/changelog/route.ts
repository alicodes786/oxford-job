import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch changelog for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    const { data: changelog, error } = await supabase
      .from('listing_operation_changelog')
      .select('*')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 changes

    if (error) {
      console.error('Error fetching changelog:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch changelog'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      changelog: changelog || []
    });
  } catch (error) {
    console.error('Error in changelog GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Add a changelog entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.change_type || !body.description) {
      return NextResponse.json({
        success: false,
        error: 'change_type and description are required'
      }, { status: 400 });
    }

    const { data: entry, error } = await supabase
      .from('listing_operation_changelog')
      .insert({
        listing_id: listingId,
        change_type: body.change_type,
        description: body.description,
        changed_by_name: body.changed_by_name || 'Admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating changelog entry:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create changelog entry'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      entry
    });
  } catch (error) {
    console.error('Error in changelog POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

