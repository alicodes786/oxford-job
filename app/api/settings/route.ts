import { NextResponse } from 'next/server';
import { getSettings, updateSettings, updateIcalSettings } from '@/lib/settings';

// GET handler for retrieving settings
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// POST handler for updating settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (body.ical) {
      // If we're updating iCal settings specifically
      const updatedSettings = updateIcalSettings(body.ical);
      return NextResponse.json(updatedSettings);
    } else {
      // General settings update
      const updatedSettings = updateSettings(body);
      return NextResponse.json(updatedSettings);
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
} 