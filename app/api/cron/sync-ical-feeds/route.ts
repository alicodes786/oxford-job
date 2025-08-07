import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Set maximum duration to 5 minutes

// This endpoint will be called by the cron job
export async function GET(request: Request) {
  try {
    // Verify this is a cron request
    const { searchParams } = new URL(request.url);
    const isCron = searchParams.get('cron') === 'true';
    
    if (!isCron) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Get settings to check if auto-sync is enabled
    const settings = getSettings();
    if (!settings.ical.autoSync) {
      return NextResponse.json({
        success: false,
        message: 'Auto-sync is disabled in settings'
      });
    }

    // Get the base URL from the request
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Instead of doing the sync here, trigger the sync-all-listings endpoint
    const response = await fetch(`${baseUrl}/api/sync-all-listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'cron'
      })
    });

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Sync process initiated',
      sessionId: result.sessionId
    });

  } catch (error) {
    console.error('Error initiating sync:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 