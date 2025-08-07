import { NextResponse } from 'next/server';

// Temporarily return empty stats until feature is ready
export async function GET() {
  return NextResponse.json({
    summary: {},
    problematic_units: [],
    common_issues: [],
    alerts: []
  });
} 