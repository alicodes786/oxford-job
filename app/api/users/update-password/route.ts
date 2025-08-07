import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, cleanerId, password } = await request.json();

    if (userId) {
      // Update user password
      const { error } = await supabase
        .from('users')
        .update({ password })
        .eq('id', userId);

      if (error) throw error;
    } else if (cleanerId) {
      // Update cleaner password
      const { error } = await supabase
        .from('cleaners')
        .update({ password })
        .eq('id', cleanerId);

      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'No user or cleaner ID provided' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
} 