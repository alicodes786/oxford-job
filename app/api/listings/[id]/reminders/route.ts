import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/listings/[id]/reminders
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data: reminders, error } = await supabase
      .from('listing_reminders')
      .select('*')
      .eq('listing_id', id)
      .order('due_date', { ascending: true });
    
    if (error) throw error;
    
    // Fetch all compliance documents for this listing
    const { data: complianceDocs, error: complianceError } = await supabase
      .from('listing_compliance_documents')
      .select('id, reminder_id, expiry_date, compliance_type')
      .eq('listing_id', id);
    
    if (complianceError) {
      console.error('Error fetching compliance docs:', complianceError);
    }
    
    // Create a map of reminder_id -> compliance document
    const complianceMap = new Map();
    (complianceDocs || []).forEach(doc => {
      if (doc.reminder_id) {
        complianceMap.set(doc.reminder_id, doc);
      }
    });
    
    // Attach compliance info to reminders
    const enrichedReminders = (reminders || []).map(reminder => ({
      ...reminder,
      compliance_document: complianceMap.get(reminder.id) || null
    }));
    
    return NextResponse.json({
      success: true,
      reminders: enrichedReminders
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST /api/listings/[id]/reminders
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { data: reminder, error } = await supabase
      .from('listing_reminders')
      .insert({
        listing_id: id,
        reminder_type: body.reminder_type,
        title: body.title,
        due_date: body.due_date,
        notes: body.notes || null,
        status: 'active'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      reminder
    });
  } catch (error) {
    console.error('Error creating reminder:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

