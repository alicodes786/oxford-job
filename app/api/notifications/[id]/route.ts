import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (typeof body.is_read !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'is_read must be a boolean'
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: body.is_read })
      .eq('id', id);

    if (error) {
      console.error('Error updating notification:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update notification'
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing notification update:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 