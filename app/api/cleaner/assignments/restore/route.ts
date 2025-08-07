import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // First, find calendar events that are active
    const { data: activeEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('is_active', true);
    
    if (eventsError) {
      throw eventsError;
    }
    
    if (!activeEvents || activeEvents.length === 0) {
      return NextResponse.json({ 
        message: 'No active events found to restore assignments for',
        restored: 0 
      });
    }
    
    const activeEventIds = activeEvents.map(event => event.id);
    
    // Find inactive assignments for active events
    const { data: inactiveAssignments, error: assignmentsError } = await supabase
      .from('cleaner_event_assignments')
      .select('id')
      .eq('is_active', false)
      .in('event_id', activeEventIds);
    
    if (assignmentsError) {
      throw assignmentsError;
    }
    
    if (!inactiveAssignments || inactiveAssignments.length === 0) {
      return NextResponse.json({ 
        message: 'No inactive assignments found for active events',
        restored: 0 
      });
    }
    
    // Restore these assignments by setting them to active
    const { error: updateError } = await supabase
      .from('cleaner_event_assignments')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .in('id', inactiveAssignments.map(assignment => assignment.id));
    
    if (updateError) {
      throw updateError;
    }
    
    return NextResponse.json({ 
      message: `Successfully restored ${inactiveAssignments.length} cleaner assignments`,
      restored: inactiveAssignments.length 
    });
  } catch (error) {
    console.error('Error restoring cleaner assignments:', error);
    return NextResponse.json(
      { error: 'Failed to restore cleaner assignments' },
      { status: 500 }
    );
  }
} 