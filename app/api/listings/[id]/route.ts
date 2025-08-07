import { NextResponse } from 'next/server';
import { updateListing } from '@/lib/models';

// GET /api/listings/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Implementation for getting a specific listing
    // This would need to be added to lib/models.ts
    return NextResponse.json({
      success: false,
      error: 'Get single listing not implemented yet'
    }, { status: 501 });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// PATCH /api/listings/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Update the listing with new data
    const updatedListing = await updateListing(id, body);
    
    return NextResponse.json({
      success: true,
      listing: updatedListing
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 