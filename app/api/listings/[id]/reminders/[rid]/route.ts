import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT /api/listings/[id]/reminders/[rid]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  try {
    const { rid } = await params;
    const body = await request.json();
    
    const updateData: any = {};
    if (body.reminder_type !== undefined) updateData.reminder_type = body.reminder_type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.due_date !== undefined) updateData.due_date = body.due_date;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
    }
    
    const { data: reminder, error } = await supabase
      .from('listing_reminders')
      .update(updateData)
      .eq('id', rid)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      reminder
    });
  } catch (error) {
    console.error('Error updating reminder:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// DELETE /api/listings/[id]/reminders/[rid]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  try {
    const { rid } = await params;
    
    const { error } = await supabase
      .from('listing_reminders')
      .delete()
      .eq('id', rid);
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

