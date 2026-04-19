import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { legacyDayToBinItem, normalizeBinCollectionArray } from '@/lib/bin-collection-schedule';

/**
 * Returns merged bin schedule per listing (operations JSON + legacy listings.bin_collection_day).
 * Used by the calendar to show “day before collection” alerts in the user’s local timezone.
 */
export async function GET() {
  try {
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, name, bin_collection_day')
      .eq('is_hidden', false);

    if (listingsError) {
      console.error('bin-collection-alerts-data listings:', listingsError);
      return NextResponse.json({ success: false, error: listingsError.message }, { status: 500 });
    }

    const { data: opsRows, error: opsError } = await supabase
      .from('listing_operations')
      .select('listing_id, bin_collection');

    if (opsError) {
      console.error('bin-collection-alerts-data operations:', opsError);
      return NextResponse.json({ success: false, error: opsError.message }, { status: 500 });
    }

    const opsByListing = new Map<string, unknown>();
    for (const row of opsRows || []) {
      opsByListing.set((row as { listing_id: string }).listing_id, (row as { bin_collection: unknown }).bin_collection);
    }

    const entries = (listings || []).map((l: { id: string; name: string; bin_collection_day: string | null }) => {
      let items = normalizeBinCollectionArray(opsByListing.get(l.id));
      if (items.length === 0 && l.bin_collection_day) {
        const legacy = legacyDayToBinItem(l.bin_collection_day);
        if (legacy) items = [legacy];
      }
      return {
        listing_id: l.id,
        listing_name: l.name,
        items,
      };
    });

    return NextResponse.json({ success: true, entries });
  } catch (e) {
    console.error('bin-collection-alerts-data:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
