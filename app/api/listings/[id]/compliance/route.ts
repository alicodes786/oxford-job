import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch all compliance documents for this listing
    const { data, error } = await supabase
      .from('listing_compliance_documents')
      .select('*')
      .eq('listing_id', id)
      .order('compliance_type', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      documents: data || [] 
    });
  } catch (error) {
    console.error('Error fetching compliance documents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch compliance documents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const {
      compliance_type,
      expiry_date,
      file_url,
      file_name,
      file_size,
      uploaded_by_user_id
    } = body;

    // Validate required fields
    if (!compliance_type || !file_url || !file_name) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if document of this type already exists for this listing
    const { data: existingDoc } = await supabase
      .from('listing_compliance_documents')
      .select('id, reminder_id')
      .eq('listing_id', id)
      .eq('compliance_type', compliance_type)
      .single();

    // If exists, delete the old one and its reminder
    if (existingDoc) {
      // Delete old reminder if it exists
      if (existingDoc.reminder_id) {
        await supabase
          .from('listing_reminders')
          .delete()
          .eq('id', existingDoc.reminder_id);
      }
      
      // Delete old document
      await supabase
        .from('listing_compliance_documents')
        .delete()
        .eq('id', existingDoc.id);
    }

    // Create reminder if expiry_date is provided
    let reminderId = null;
    if (expiry_date) {
      // Calculate reminder date (30 days before expiry)
      const expiryDateObj = new Date(expiry_date);
      const reminderDateObj = new Date(expiryDateObj);
      reminderDateObj.setDate(reminderDateObj.getDate() - 30);

      const reminderTypeMap: Record<string, string> = {
        gas_cert: 'safety',
        eicr: 'safety',
        pat_test: 'safety',
        insurance: 'insurance',
        fire_risk: 'safety',
        ownership: 'other'
      };

      const complianceTypeNames: Record<string, string> = {
        gas_cert: 'Gas Certificate',
        eicr: 'EICR',
        pat_test: 'PAT Test',
        insurance: 'Insurance Certificate',
        fire_risk: 'Fire Risk Assessment',
        ownership: 'Ownership/Landlord Agreement'
      };

      // Create reminder
      const { data: reminderData, error: reminderError } = await supabase
        .from('listing_reminders')
        .insert({
          listing_id: id,
          reminder_type: reminderTypeMap[compliance_type] || 'other',
          title: `${complianceTypeNames[compliance_type]} Expiring Soon`,
          due_date: reminderDateObj.toISOString().split('T')[0],
          notes: `This document expires on ${expiryDateObj.toISOString().split('T')[0]}. Please renew before expiry.`,
          status: 'active'
        })
        .select()
        .single();

      if (reminderError) {
        console.error('Error creating reminder:', reminderError);
      } else {
        reminderId = reminderData?.id;
      }
    }

    // Insert new compliance document
    const { data: newDoc, error: insertError } = await supabase
      .from('listing_compliance_documents')
      .insert({
        listing_id: id,
        compliance_type,
        expiry_date: expiry_date || null,
        file_url,
        file_name,
        file_size: file_size || null,
        uploaded_by_user_id: uploaded_by_user_id || null,
        reminder_id: reminderId
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ 
      success: true, 
      document: newDoc,
      reminder_created: !!reminderId
    });
  } catch (error) {
    console.error('Error creating compliance document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create compliance document' },
      { status: 500 }
    );
  }
}

