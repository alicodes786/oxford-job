import { NextResponse } from 'next/server';
import { getCleanerById } from '@/lib/models';

// GET /api/cleaners/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleaner = await getCleanerById(id);
    
    if (!cleaner) {
      return NextResponse.json({
        success: false,
        error: 'Cleaner not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      cleaner
    });
  } catch (error) {
    console.error('Error fetching cleaner:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 