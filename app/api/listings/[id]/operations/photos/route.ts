import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all photos for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    const { data: photos, error } = await supabase
      .from('listing_operation_photos')
      .select('*')
      .eq('listing_id', listingId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching photos:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch photos'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photos: photos || []
    });
  } catch (error) {
    console.error('Error in photos GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Upload a photo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.photo_url || !body.photo_type) {
      return NextResponse.json({
        success: false,
        error: 'photo_url and photo_type are required'
      }, { status: 400 });
    }

    const { data: photo, error } = await supabase
      .from('listing_operation_photos')
      .insert({
        listing_id: listingId,
        photo_type: body.photo_type,
        photo_url: body.photo_url,
        photo_description: body.photo_description || null,
        uploaded_by_name: body.uploaded_by_name || 'Admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Error uploading photo:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to upload photo'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      photo
    });
  } catch (error) {
    console.error('Error in photos POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

