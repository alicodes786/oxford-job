import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE /api/listings/[id]/documents/[did]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; did: string }> }
) {
  try {
    const { did } = await params;
    
    // Get document to retrieve file_url for Cloudinary deletion (optional)
    const { data: document, error: fetchError } = await supabase
      .from('listing_documents')
      .select('*')
      .eq('id', did)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Delete from database
    const { error } = await supabase
      .from('listing_documents')
      .delete()
      .eq('id', did);
    
    if (error) throw error;
    
    // TODO: Optionally delete from Cloudinary
    // This would require extracting public_id from file_url and calling Cloudinary API
    
    return NextResponse.json({
      success: true,
      deleted_file_url: document?.file_url
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

