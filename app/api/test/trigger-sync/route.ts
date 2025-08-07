import { NextResponse } from 'next/server';

// This is a development-only endpoint to test the cron sync
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      success: false, 
      error: 'This endpoint is only available in development mode' 
    }, { status: 403 });
  }

  try {
    // Call the cron endpoint directly
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    const response = await fetch(`${baseUrl}/api/cron/sync-ical-feeds?cron=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Test sync triggered',
      result
    });

  } catch (error) {
    console.error('Error in test sync:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 });
  }
} 