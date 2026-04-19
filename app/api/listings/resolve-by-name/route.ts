import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/listings/resolve-by-name?name=...
 * Resolves a listing row id from the canonical `listings.name` (exact match).
 * Used when calendar events have listing_name but no listing_id (common for synced events).
 */
export async function GET(request: NextRequest) {
  try {
    const name = request.nextUrl.searchParams.get('name');
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }

    const trimmed = name.trim();

    const { data, error } = await supabase
      .from('listings')
      .select('id, name')
      .eq('name', trimmed)
      .maybeSingle();

    if (error) {
      console.error('resolve-by-name:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      listing: data ?? null,
    });
  } catch (e) {
    console.error('resolve-by-name:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
