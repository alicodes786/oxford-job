import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { format, parse } from 'date-fns';

interface JobCompletionData {
  assignment_uuid: string;
  cleaner_uuid: string;
  date: string;
  listing_name: string;
  cleanliness_rating: number;
  damage_question: 'Yes' | 'No' | 'Maybe';
  damage_images?: string[];
  checklist_items: {
    remote_in_unit: boolean;
    iron_in_unit: boolean;
    hair_dryer_in_unit: boolean;
    new_bedding_clean: boolean;
    bathroom_clean: boolean;
    hot_water_working: boolean;
    heating_working: boolean;
    floors_cleaned_and_hoovered: boolean;
    cutlery_check: boolean;
    towels_checked: boolean;
    keys_left_in_box: boolean;
  };
  missing_items_details: string;
  post_cleaning_images?: string[];
  start_time: string;
}

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
    
    if (!body.date) {
      return NextResponse.json({
        success: false,
        error: 'date is required'
      }, { status: 400 });
    }

    // Ensure the date is in correct format (YYYY-MM-DD)
    const today = new Date();
    const formattedDate = format(today, 'yyyy-MM-dd');
    
    if (!body.listing_name) {
      return NextResponse.json({
        success: false,
        error: 'listing_name is required'
      }, { status: 400 });
    }
    
    // Validate rating is between 1 and 5
    const rating = parseInt(body.cleanliness_rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({
        success: false,
        error: 'cleanliness_rating must be between 1 and 5'
      }, { status: 400 });
    }
    
    // Validate damage question
    if (!['Yes', 'No', 'Maybe'].includes(body.damage_question)) {
      return NextResponse.json({
        success: false,
        error: 'damage_question must be Yes, No, or Maybe'
      }, { status: 400 });
    }
    
    // Get the timer for this assignment
    const { data: timers, error: timerError } = await supabase
      .from('job_timers')
      .select('*')
      .eq('assignment_uuid', body.assignment_uuid)
      .order('created_at', { ascending: false });

    if (timerError) {
      console.error('Error fetching timer:', timerError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch timer'
      }, { status: 500 });
    }

    if (!timers || timers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No timer found for this assignment. Please start the job first.'
      }, { status: 400 });
    }

    // Use the most recent timer
    const timer = timers[0];

    // Calculate duration using timer start time and current time
    const startTime = new Date(timer.start_time);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const durationMinutes = Math.round(durationSeconds / 60);
    
    // Prepare job completion data
    const jobCompletionData = {
      assignment_uuid: body.assignment_uuid,
      cleaner_uuid: body.cleaner_uuid,
      completion_date: formattedDate,  // Use the properly formatted date
      listing_name: body.listing_name,
      cleanliness_rating: rating,
      damage_question: body.damage_question,
      damage_images: body.damage_images || [],
      checklist_items: body.checklist_items || {},
      missing_items_details: body.missing_items_details || '',
      post_cleaning_images: body.post_cleaning_images || [],
      start_time: timer.start_time,
      end_time: endTime.toISOString(),
      duration_seconds: durationSeconds,
      created_at: new Date().toISOString(),
    };
    
    // Save to database
    const { data, error } = await supabase
      .from('job_completions')
      .insert([jobCompletionData])
      .select()
      .single();
    
    if (error) {
      console.error('Database error saving job completion:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to save job completion data'
      }, { status: 500 });
    }

    // Create notification
    const { error: notificationError } = await supabase
      .from('job_notifications')
      .insert([{
        assignment_uuid: body.assignment_uuid,
        cleaner_uuid: body.cleaner_uuid,
        listing_name: body.listing_name,
        completion_date: formattedDate,  // Use the same properly formatted date
        cleanliness_rating: rating,
        damage_question: body.damage_question,
        duration_minutes: durationMinutes,
        created_at: new Date().toISOString(),
        is_read: false
      }]);

    if (notificationError) {
      console.warn('Warning: Failed to create notification:', notificationError);
    }
    
    // Delete all timers for this assignment
    await supabase
      .from('job_timers')
      .delete()
      .eq('assignment_uuid', body.assignment_uuid);
    
    // Update the assignment status to completed
    const { error: updateError } = await supabase
      .from('cleaner_assignments')
      .update({ 
        is_completed: true,
        completed_at: endTime.toISOString()
      })
      .eq('uuid', body.assignment_uuid);
    
    if (updateError) {
      console.warn('Warning: Failed to update assignment completion status:', updateError);
    }
    
    return NextResponse.json({
      success: true,
      job_completion: data,
      message: 'Job completed successfully',
      duration_minutes: durationMinutes
    });
    
  } catch (error) {
    console.error('Error processing job completion:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 