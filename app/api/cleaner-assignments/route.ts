import { NextResponse } from 'next/server';
import { 
  getCleanerAssignments, 
  createCleanerAssignment, 
  updateCleanerAssignment, 
  deleteCleanerAssignment 
} from '@/lib/calendar-models';

// Get all cleaner assignments or filter by cleaner UUID
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cleanerUuid = url.searchParams.get('cleanerUuid');
    
    const assignments = await getCleanerAssignments(cleanerUuid || undefined);
    
    return NextResponse.json({
      success: true,
      assignments,
      count: assignments.length
    });
  } catch (error) {
    console.error('Error fetching cleaner assignments:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// Create a new cleaner assignment
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.cleaner_uuid || !body.event_uuid || !body.hours) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: cleaner_uuid, event_uuid, and hours are all required'
      }, { status: 400 });
    }
    
    // Create the assignment
    const assignment = await createCleanerAssignment({
      cleaner_uuid: body.cleaner_uuid,
      event_uuid: body.event_uuid,
      hours: body.hours || 2.0,
      is_active: body.is_active !== undefined ? body.is_active : true
    });
    
    return NextResponse.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Error creating cleaner assignment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// Update an existing cleaner assignment
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.uuid) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: uuid is required'
      }, { status: 400 });
    }
    
    // Update the assignment
    const assignment = await updateCleanerAssignment(body.uuid, {
      cleaner_uuid: body.cleaner_uuid,
      hours: body.hours,
      is_active: body.is_active
    });
    
    return NextResponse.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Error updating cleaner assignment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// Delete a cleaner assignment
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    
    if (!uuid) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameter: uuid'
      }, { status: 400 });
    }
    
    await deleteCleanerAssignment(uuid);
    
    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting cleaner assignment:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 