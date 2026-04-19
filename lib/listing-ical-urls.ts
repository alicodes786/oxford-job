import { supabase } from '@/lib/supabase';
import {
  associateIcalFeedWithListing,
  createIcalFeed,
  getIcalFeedsForListing,
  updateIcalFeed,
  removeIcalFeedFromListing,
  type IcalFeed,
} from '@/lib/models';

export function sortFeedsForDisplay(feeds: IcalFeed[]): IcalFeed[] {
  return [...feeds].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  );
}

async function validateIcalUrl(url: string): Promise<{ detectedListingName?: string }> {
  const response = await fetch('/api/fetch-ical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Invalid iCal URL');
  return data;
}

/**
 * Syncs the first two calendar feeds (by created_at) with two URL fields.
 * Additional feeds on the listing are left unchanged.
 */
export async function applyListingIcalUrlChanges(params: {
  listingId: string;
  listingName: string;
  listingColor: string | null;
  url1: string;
  url2: string;
}): Promise<void> {
  const u1 = params.url1.trim();
  const u2 = params.url2.trim();

  if (!u1) throw new Error('Primary iCal URL is required');
  if (u2 && u1 === u2) throw new Error('The two iCal URLs must be different');

  await validateIcalUrl(u1);
  let u2ValidateResult: { detectedListingName?: string } | undefined;
  if (u2) u2ValidateResult = await validateIcalUrl(u2);

  let feeds = sortFeedsForDisplay(await getIcalFeedsForListing(params.listingId));
  let f1 = feeds[0];

  if (f1) {
    if (f1.url !== u1) {
      await updateIcalFeed(f1.id, { url: u1 });
    }
  } else {
    const externalId = `feed-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    await createIcalFeed(
      {
        external_id: externalId,
        url: u1,
        name: params.listingName,
        last_synced: null,
        is_active: true,
        color: params.listingColor,
      },
      params.listingId
    );
  }

  feeds = sortFeedsForDisplay(await getIcalFeedsForListing(params.listingId));
  f1 = feeds[0];
  const f2After = feeds[1];

  if (!u2) {
    if (f2After) {
      await removeIcalFeedFromListing(params.listingId, f2After.id);
    }
    return;
  }

  if (f2After) {
    if (f2After.url !== u2) {
      await updateIcalFeed(f2After.id, { url: u2 });
    }
    return;
  }

  const { data: existingFeed } = await supabase
    .from('ical_feeds')
    .select('*')
    .eq('url', u2)
    .maybeSingle();

  if (existingFeed) {
    await associateIcalFeedWithListing(params.listingId, existingFeed.id);
    return;
  }

  const detectedName = u2ValidateResult?.detectedListingName || `${params.listingName} (feed 2)`;
  const externalId = `feed-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  await createIcalFeed(
    {
      external_id: externalId,
      url: u2,
      name: detectedName,
      last_synced: null,
      is_active: true,
      color: params.listingColor,
    },
    params.listingId
  );
}
