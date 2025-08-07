import { NextResponse } from 'next/server';
import { getCleaners } from '@/lib/models';

// GET /api/cleaners
export async function GET() {
  try {
    const cleaners = await getCleaners();
    
    return NextResponse.json({
      success: true,
      cleaners
    });
  } catch (error) {
    console.error('Error fetching cleaners:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 