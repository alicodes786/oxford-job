import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get count of active cleaner assignments
    const { count, error } = await supabase
      .from('cleaner_event_assignments')
      .select('*', { count: 'exact' })
      .eq('is_active', true);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error counting cleaner assignments:', error);
    return NextResponse.json(
      { error: 'Failed to count cleaner assignments' },
      { status: 500 }
    );
  }
} 