'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getIcalFeedsForListing } from '@/lib/models';
import { applyListingIcalUrlChanges, sortFeedsForDisplay } from '@/lib/listing-ical-urls';

interface ListingCalendarFeedsSectionProps {
  listingId: string;
  listingName: string;
  listingColor: string | null;
}

export function ListingCalendarFeedsSection({
  listingId,
  listingName,
  listingColor,
}: ListingCalendarFeedsSectionProps) {
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  const [extraFeedCount, setExtraFeedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const feeds = sortFeedsForDisplay(await getIcalFeedsForListing(listingId));
      setUrl1(feeds[0]?.url ?? '');
      setUrl2(feeds[1]?.url ?? '');
      setExtraFeedCount(Math.max(0, feeds.length - 2));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load calendar feeds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [listingId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await applyListingIcalUrlChanges({
        listingId,
        listingName,
        listingColor,
        url1,
        url2,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }
      toast.success('Calendar links updated');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save calendar links');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Calendar className="h-5 w-5 mr-2" />
          Calendar feeds (iCal)
        </CardTitle>
        <CardDescription>
          Primary and optional second booking calendar URL. Used for sync and the property calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading feeds…
          </div>
        ) : (
          <>
            {extraFeedCount > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                This listing has {extraFeedCount} additional calendar feed
                {extraFeedCount !== 1 ? 's' : ''} beyond the first two. Only the first two slots are
                edited here.
              </p>
            )}
            <div>
              <Label htmlFor="profile-ical-1">Primary iCal URL</Label>
              <Input
                id="profile-ical-1"
                className="mt-1"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={url1}
                onChange={(e) => setUrl1(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="profile-ical-2">Second iCal URL (optional)</Label>
              <Input
                id="profile-ical-2"
                className="mt-1"
                placeholder="Optional second calendar"
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
              />
            </div>
            <Button type="button" onClick={handleSave} disabled={saving || !url1.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save calendar links'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
