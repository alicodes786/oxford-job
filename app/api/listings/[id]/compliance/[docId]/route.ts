import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    const body = await request.json();
    
    const { expiry_date, file_url, file_name, file_size } = body;

    // Get existing document
    const { data: existingDoc, error: fetchError } = await supabase
      .from('listing_compliance_documents')
      .select('*')
      .eq('id', docId)
      .eq('listing_id', id)
      .single();

    if (fetchError || !existingDoc) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Handle reminder updates
    let reminderId = existingDoc.reminder_id;
    
    // If expiry date changed or is being added/removed
    if (expiry_date !== existingDoc.expiry_date) {
      // Delete old reminder if it exists
      if (existingDoc.reminder_id) {
        await supabase
          .from('listing_reminders')
          .delete()
          .eq('id', existingDoc.reminder_id);
        reminderId = null;
      }

      // Create new reminder if expiry_date is provided
      if (expiry_date) {
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

        const { data: reminderData, error: reminderError } = await supabase
          .from('listing_reminders')
          .insert({
            listing_id: id,
            reminder_type: reminderTypeMap[existingDoc.compliance_type] || 'other',
            title: `${complianceTypeNames[existingDoc.compliance_type]} Expiring Soon`,
            due_date: reminderDateObj.toISOString().split('T')[0],
            notes: `This document expires on ${expiryDateObj.toISOString().split('T')[0]}. Please renew before expiry.`,
            status: 'active'
          })
          .select()
          .single();

        if (!reminderError && reminderData) {
          reminderId = reminderData.id;
        }
      }
    }

    // Update document
    const updateData: any = {
      expiry_date: expiry_date || null,
      reminder_id: reminderId
    };

    // Only update file info if provided
    if (file_url) updateData.file_url = file_url;
    if (file_name) updateData.file_name = file_name;
    if (file_size !== undefined) updateData.file_size = file_size;

    const { data: updatedDoc, error: updateError } = await supabase
      .from('listing_compliance_documents')
      .update(updateData)
      .eq('id', docId)
      .eq('listing_id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      document: updatedDoc 
    });
  } catch (error) {
    console.error('Error updating compliance document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update compliance document' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;

    // Get document to find associated reminder
    const { data: doc, error: fetchError } = await supabase
      .from('listing_compliance_documents')
      .select('reminder_id')
      .eq('id', docId)
      .eq('listing_id', id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete associated reminder if exists
    if (doc?.reminder_id) {
      await supabase
        .from('listing_reminders')
        .delete()
        .eq('id', doc.reminder_id);
    }

    // Delete document
    const { error: deleteError } = await supabase
      .from('listing_compliance_documents')
      .delete()
      .eq('id', docId)
      .eq('listing_id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting compliance document:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete compliance document' },
      { status: 500 }
    );
  }
}

