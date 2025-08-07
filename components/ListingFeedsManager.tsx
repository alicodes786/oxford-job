import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Trash2, Check, X, RefreshCw, Calendar } from 'lucide-react';
import { getIcalFeedsForListing, createIcalFeed, deleteIcalFeed, updateIcalFeed, IcalFeed, associateIcalFeedWithListing } from '@/lib/models';
import { supabase } from '@/lib/supabase';

interface ListingFeedsManagerProps {
  listingId: string;
  listingName: string;
  listingColor: string | null;
  onUpdate?: () => void;
}

export function ListingFeedsManager({ listingId, listingName, listingColor, onUpdate }: ListingFeedsManagerProps) {
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [existingFeeds, setExistingFeeds] = useState<IcalFeed[]>([]);
  const [selectedExistingFeedId, setSelectedExistingFeedId] = useState<string>('');
  
  // Load feeds for this listing
  useEffect(() => {
    loadFeeds();
    loadAllFeeds();
  }, [listingId]);

  const loadFeeds = async () => {
    setIsLoading(true);
    try {
      const feedsData = await getIcalFeedsForListing(listingId);
      setFeeds(feedsData);
    } catch (error) {
      console.error('Error loading feeds:', error);
      toast.error('Failed to load feeds for this listing');
    } finally {
      setIsLoading(false);
    }
  };

  // Load all existing feeds to allow attaching existing ones
  const loadAllFeeds = async () => {
    try {
      const { data: allFeeds, error } = await supabase
        .from('ical_feeds')
        .select('*');
        
      if (error) throw error;
      
      if (allFeeds) {
        // Get current feeds for this listing to filter them out
        const currentFeedIds = feeds.map(f => f.id);
        const availableFeeds = allFeeds.filter(f => !currentFeedIds.includes(f.id));
        setExistingFeeds(availableFeeds);
      }
    } catch (error) {
      console.error('Error loading all feeds:', error);
    }
  };
  
  // Add a new feed to this listing
  const addFeedToListing = async () => {
    if (!newFeedUrl) {
      toast.error('Please enter an iCal URL');
      return;
    }
    
    setIsLoading(true);
    try {
      // Validate the URL first
      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: newFeedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate iCal URL');
      }
      
      // Check if a feed with this URL already exists
      const { data: existingFeed } = await supabase
        .from('ical_feeds')
        .select('*')
        .eq('url', newFeedUrl)
        .maybeSingle();
        
      if (existingFeed) {
        // Associate the existing feed with this listing
        await associateIcalFeedWithListing(listingId, existingFeed.id);
        toast.success('Existing feed added to listing');
      } else {
        // Generate a unique external ID
        const externalId = `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create the feed and associate it with this listing
        const newFeed = await createIcalFeed({
          external_id: externalId,
          url: newFeedUrl,
          name: data.detectedListingName || `${listingName} Feed ${feeds.length + 1}`,
          last_synced: null,
          is_active: true,
          color: listingColor
        }, listingId);
        
        toast.success('New feed added to listing');
      }
      
      // Reload the feeds to show the updated list
      await loadFeeds();
      await loadAllFeeds();
      
      setNewFeedUrl('');
      
      // Notify parent component if needed
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding feed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add feed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Associate an existing feed with this listing
  const associateExistingFeed = async () => {
    if (!selectedExistingFeedId) {
      toast.error('Please select a feed to add');
      return;
    }
    
    setIsLoading(true);
    try {
      await associateIcalFeedWithListing(listingId, selectedExistingFeedId);
      
      toast.success('Feed added to listing');
      
      // Reload the feeds to show the updated list
      await loadFeeds();
      await loadAllFeeds();
      
      setSelectedExistingFeedId('');
      
      // Notify parent component if needed
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error associating feed:', error);
      toast.error('Failed to add feed to listing');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Remove feed from listing
  const removeFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to remove this feed from the listing?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Remove the association but don't delete the feed itself
      const { error } = await supabase
        .from('listing_ical_feeds')
        .delete()
        .match({ listing_id: listingId, ical_feed_id: feedId });
      
      if (error) throw error;
      
      setFeeds(feeds.filter(feed => feed.id !== feedId));
      toast.success('Feed removed from listing');
      
      // Reload existing feeds
      await loadAllFeeds();
      
      // Notify parent component if needed
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error removing feed:', error);
      toast.error('Failed to remove feed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle feed active status
  const toggleFeedStatus = async (feedId: string) => {
    setIsLoading(true);
    try {
      const feed = feeds.find(f => f.id === feedId);
      if (!feed) return;
      
      const newStatus = !feed.is_active;
      const updatedFeed = await updateIcalFeed(feedId, { 
        is_active: newStatus
      });
      
      setFeeds(feeds.map(f => f.id === feedId ? updatedFeed : f));
      toast.success(`Feed ${newStatus ? 'enabled' : 'disabled'}`);
      
      // Notify parent component if needed
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error toggling feed status:', error);
      toast.error('Failed to update feed status');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Test a feed URL
  const testFeedUrl = async (url: string) => {
    if (!url) {
      toast.error('URL is empty');
      return;
    }
    
    try {
      toast.loading('Testing URL...', { id: 'url-test' });
      
      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        toast.error(`URL test failed: ${data.error}`, { id: 'url-test' });
        return;
      }
      
      const eventCount = data.events ? data.events.length : 0;
      const message = `Successfully connected! Found ${eventCount} events. ` + 
                     `Calendar name: ${data.detectedListingName || 'Unknown'}`;
      
      toast.success(message, { id: 'url-test' });
    } catch (error) {
      toast.error(`URL test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'url-test' });
    }
  };
  
  return (
    <div className="mt-4 space-y-4">
      <h3 className="text-lg font-medium">Calendar Feeds for {listingName}</h3>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading feeds...</span>
        </div>
      ) : (
        <>
          {feeds.length === 0 ? (
            <p className="text-sm text-gray-500">No feeds added to this listing yet.</p>
          ) : (
            <div className="space-y-2">
              {feeds.map(feed => (
                <div key={feed.id} className="p-3 border rounded-md bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{feed.name}</div>
                      <div className="text-xs text-gray-500 truncate">{feed.url}</div>
                      {feed.last_synced && (
                        <div className="text-xs text-gray-400 mt-1">
                          Last synced: {new Date(feed.last_synced).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFeedStatus(feed.id)}
                        className={feed.is_active ? "text-green-600" : "text-gray-400"}
                      >
                        {feed.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testFeedUrl(feed.url)}
                      >
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFeed(feed.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium mb-2">Add a new calendar feed</h4>
            
            <div className="space-y-4">
              {/* Add new URL */}
              <div>
                <Label htmlFor="new-feed-url">Add new calendar URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="new-feed-url"
                    placeholder="Enter iCal URL"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={addFeedToListing}
                    disabled={isLoading || !newFeedUrl}
                  >
                    Add URL
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Add an iCal calendar feed for this listing to combine multiple booking sources.
                </p>
              </div>
              
              {/* Or choose existing feed */}
              {existingFeeds.length > 0 && (
                <div>
                  <Label htmlFor="existing-feed">Or add an existing feed</Label>
                  <div className="flex gap-2 mt-1">
                    <select 
                      id="existing-feed"
                      className="flex-1 border rounded-md p-2"
                      value={selectedExistingFeedId}
                      onChange={(e) => setSelectedExistingFeedId(e.target.value)}
                    >
                      <option value="">Select an existing feed</option>
                      {existingFeeds.map(feed => (
                        <option key={feed.id} value={feed.id}>
                          {feed.name} ({feed.url.substring(0, 30)}...)
                        </option>
                      ))}
                    </select>
                    <Button 
                      onClick={associateExistingFeed}
                      disabled={isLoading || !selectedExistingFeedId}
                    >
                      Add Feed
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use a feed that's already in the system.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 