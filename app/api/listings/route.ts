import { NextResponse } from 'next/server';
import { getListings } from '@/lib/models';

export async function GET() {
  try {
    const listings = await getListings();
    
    return NextResponse.json({
      success: true,
      listings
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 