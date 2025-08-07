import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    console.log('Received update checkout time request');
    
    // Parse the request body
    const body = await request.json();
    const { eventId, checkoutTime } = body;
    
    console.log('Request payload:', { eventId, checkoutTime });
    
    if (!eventId || !checkoutTime) {
      console.log('Missing required parameters');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Event ID and checkout time are required' 
        }, 
        { status: 400 }
      );
    }
    
    // Handle edge cases where eventId might contain additional information
    const cleanEventId = eventId.trim();
    console.log('Using event ID for update:', cleanEventId);
    
    // First try to update by uuid
    console.log(`Attempting to update events table with checkout_time=${checkoutTime} for uuid=${cleanEventId}`);
    
    const { data, error } = await supabase
      .from('events')
      .update({ 
        checkout_time: checkoutTime,
        updated_at: new Date().toISOString()
      })
      .eq('uuid', cleanEventId)
      .select();
    
    // If we get an error or no data was updated, try to lookup by event_id as fallback
    if (error || !data || data.length === 0) {
      if (error) {
        console.error('Supabase error updating checkout time by uuid:', error);
      } else {
        console.log('No records updated by uuid. Trying to find by event_id instead.');
      }
      
      // Try to find the event by event_id
      const { data: eventData, error: findError } = await supabase
        .from('events')
        .select('uuid')
        .eq('event_id', cleanEventId)
        .limit(1);
      
      if (findError) {
        console.error('Error checking if event exists by event_id:', findError);
        return NextResponse.json(
          { 
            success: false, 
            error: findError.message 
          }, 
          { status: 500 }
        );
      }
      
      if (!eventData || eventData.length === 0) {
        console.error('Event not found by uuid or event_id:', cleanEventId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Event not found' 
          }, 
          { status: 404 }
        );
      }
      
      // We found the event by event_id, now update using its uuid
      const actualUuid = eventData[0].uuid;
      console.log(`Found event by event_id. Using uuid=${actualUuid} for update`);
      
      const { data: updatedData, error: updateError } = await supabase
        .from('events')
        .update({ 
          checkout_time: checkoutTime,
          updated_at: new Date().toISOString()
        })
        .eq('uuid', actualUuid)
        .select();
      
      if (updateError) {
        console.error('Supabase error updating checkout time with found uuid:', updateError);
        return NextResponse.json(
          { 
            success: false, 
            error: updateError.message 
          }, 
          { status: 500 }
        );
      }
      
      if (!updatedData || updatedData.length === 0) {
        console.error('No records updated even after finding correct uuid.');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to update event checkout time' 
          }, 
          { status: 500 }
        );
      }
      
      console.log('Successfully updated checkout time after lookup:', updatedData[0]);
      
      return NextResponse.json({ 
        success: true, 
        data: updatedData[0] 
      });
    }
    
    console.log('Successfully updated checkout time:', data[0]);
    
    return NextResponse.json({ 
      success: true, 
      data: data[0] 
    });
  } catch (error) {
    console.error('Unhandled error in update-checkout-time API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
} 