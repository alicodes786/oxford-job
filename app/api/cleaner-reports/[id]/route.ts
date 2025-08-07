import { NextRequest, NextResponse } from 'next/server';
import { getJobCompletionReport } from '@/lib/cleaner-reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Report ID is required'
      }, { status: 400 });
    }

    const report = await getJobCompletionReport(id);

    if (!report) {
      return NextResponse.json({
        success: false,
        error: 'Report not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Error in cleaner-reports [id] API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 