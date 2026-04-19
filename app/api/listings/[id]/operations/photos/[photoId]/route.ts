import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE - Delete a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { photoId } = await params;

    const { error } = await supabase
      .from('listing_operation_photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      console.error('Error deleting photo:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete photo'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error in photo DELETE:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

