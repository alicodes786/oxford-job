import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/listings/[id]/documents
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data: documents, error } = await supabase
      .from('listing_documents')
      .select('*')
      .eq('listing_id', id)
      .order('uploaded_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      documents: documents || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST /api/listings/[id]/documents
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Upload to Cloudinary handled on client side
    // This endpoint saves the document metadata
    const { data: document, error } = await supabase
      .from('listing_documents')
      .insert({
        listing_id: id,
        file_name: body.file_name,
        file_url: body.file_url,
        file_type: body.file_type || null,
        file_size: body.file_size || null,
        description: body.description || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error creating document:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

