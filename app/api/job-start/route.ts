import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.assignment_uuid) {
      return NextResponse.json({
        success: false,
        error: 'assignment_uuid is required'
      }, { status: 400 });
    }
    
    if (!body.cleaner_uuid) {
      return NextResponse.json({
        success: false,
        error: 'cleaner_uuid is required'
      }, { status: 400 });
    }

    // First, delete any existing timers for this assignment (cleanup)
    await supabase
      .from('job_timers')
      .delete()
      .eq('assignment_uuid', body.assignment_uuid);

    // Create new timer
    const { data, error } = await supabase
      .from('job_timers')
      .insert([{
        assignment_uuid: body.assignment_uuid,
        cleaner_uuid: body.cleaner_uuid,
        start_time: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error starting timer:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to start timer'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      timer: data,
      message: 'Timer started successfully'
    });

  } catch (error) {
    console.error('Error in job-start API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 