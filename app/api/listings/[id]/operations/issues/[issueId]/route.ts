import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT - Update an issue
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const { issueId } = await params;
    const body = await request.json();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only update fields that are provided
    if (body.issue_date !== undefined) updateData.issue_date = body.issue_date;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to;
    if (body.cost !== undefined) updateData.cost = body.cost;
    if (body.status !== undefined) {
      updateData.status = body.status;
      // If marking as resolved, set resolved_at timestamp
      if (body.status === 'resolved' && !body.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }
    }
    if (body.resolution_notes !== undefined) updateData.resolution_notes = body.resolution_notes;
    if (body.resolved_at !== undefined) updateData.resolved_at = body.resolved_at;

    const { data: issue, error } = await supabase
      .from('listing_issue_log')
      .update(updateData)
      .eq('id', issueId)
      .select()
      .single();

    if (error) {
      console.error('Error updating issue:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to update issue'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      issue
    });
  } catch (error) {
    console.error('Error in issue PUT:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// DELETE - Delete an issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> }
) {
  try {
    const { issueId } = await params;

    const { error } = await supabase
      .from('listing_issue_log')
      .delete()
      .eq('id', issueId);

    if (error) {
      console.error('Error deleting issue:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to delete issue'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error in issue DELETE:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

