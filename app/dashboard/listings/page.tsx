'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Trash2, Plus, Download, Calendar, Copy, Pencil, Check, X, RefreshCw, Clock, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import {
  getIcalFeeds,
  getIcalFeedsForListing,
  updateIcalFeed,
  deleteIcalFeed,
  getListings,
  createListing,
  updateListing,
  deleteListing,
  createIcalFeed
} from '@/lib/models';
import { IcalFeed, Listing } from '@/lib/models';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProtectedRoute from '@/components/ProtectedRoute';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ListingFeedsManager } from '@/components/ListingFeedsManager';
import { supabase } from '@/lib/supabase';
import { Badge } from "@/components/ui/badge";
import { groupListingsByName } from '@/lib/utils';

function ListingsPageContent() {
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editHours, setEditHours] = useState(2.0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  const [listingHours, setListingHours] = useState<Record<string, number>>({});
  const [manageFeedsDialogOpen, setManageFeedsDialogOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingFeeds, setListingFeeds] = useState<Record<string, IcalFeed[]>>({});
  const [editFeeds, setEditFeeds] = useState<IcalFeed[]>([]);
  const [newEditFeedUrl, setNewEditFeedUrl] = useState('');
  const [feedAssociations, setFeedAssociations] = useState<Record<string, number>>({});
  const [newColor, setNewColor] = useState('#4f46e5');
  const [newHours, setNewHours] = useState(2.0);
  const [newBankAccount, setNewBankAccount] = useState<string | undefined>(undefined);
  const [editBankAccount, setEditBankAccount] = useState<string | undefined>(undefined);

  // Colors for different listings
  const listingColors = [
    '#4f46e5', // indigo
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#6366f1', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#8b5cf6', // purple
    '#f97316', // orange
    '#14b8a6', // teal
  ];

  // Load feeds and settings
  useEffect(() => {
    setIsClient(true);
    loadFeeds();
    loadLastSync();
    
    // Set up the reload interval
    const interval = setInterval(() => {
      loadFeeds();
    }, 60 * 1000); // Reload every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Load last sync time from API
  const loadLastSync = async () => {
    try {
      const response = await fetch('/api/settings');
      
      if (response.ok) {
        const settings = await response.json();
        if (settings.ical && settings.ical.lastSync) {
          setLastSync(settings.ical.lastSync);
        }
      } else {
        console.error('Error loading settings:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  // Save last sync time to API
  const saveLastSync = async (lastSync: string) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ical: {
            lastSync
          }
        }),
      });
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  };

  const loadFeedAssociations = async () => {
    try {
      // For each listing, count how many feeds are associated with it
      const associationsMap: Record<string, number> = {};
      
      // Get all listing-feed associations
      const { data: associations, error } = await supabase
        .from('listing_ical_feeds')
        .select('*');
      
      if (error) {
        console.error('Error loading feed associations:', error);
        return;
      }
      
      // Count associations per listing
      if (associations) {
        // Group by listing_id
        const countByListingId: Record<string, number> = {};
        
        for (const assoc of associations) {
          countByListingId[assoc.listing_id] = (countByListingId[assoc.listing_id] || 0) + 1;
        }
        
        // Update the state with the counts
        setFeedAssociations(countByListingId);
      }
    } catch (error) {
      console.error('Error loading feed associations:', error);
    }
  };

  const loadFeeds = async () => {
    if (typeof window === 'undefined') return;
    
    setIsLoading(true);
    try {
      // Load listings from the listings table
      const listingsData = await getListings();
      setListings(listingsData);
      
      // For each listing, load its associated feeds
      const feedsMap: Record<string, IcalFeed[]> = {};
      const hoursMap: Record<string, number> = {};
      
      for (const listing of listingsData) {
        try {
          const feeds = await getIcalFeedsForListing(listing.id);
          feedsMap[listing.id] = feeds;
          hoursMap[listing.id] = listing.hours || 2.0;
        } catch (error) {
          console.error(`Error loading feeds for listing ${listing.id}:`, error);
        }
      }
      
      setListingFeeds(feedsMap);
      setListingHours(hoursMap);
      
      // Also load feed associations for UI indicators
      await loadFeedAssociations();
    } catch (error) {
      console.error('Error loading listings and feeds:', error);
      toast.error('Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  };

  // Fix the addListing function properties and remove duplicate fields
  const addListing = async () => {
    if (!newName) {
      toast.error('Please enter a listing name');
      return;
    }

    if (!newUrl) {
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
        body: JSON.stringify({ url: newUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate iCal URL');
      }

      // Get a color for the new listing
      const colorIndex = listings.length % listingColors.length;
      const color = listingColors[colorIndex];

      // Generate a unique external ID
      const externalId = `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create the listing with the iCal URL
      const newListing = await createListing({
        external_id: externalId,
        name: newName,
        color: color,
        hours: newHours,
        bank_account: newBankAccount || null
      }, [newUrl]); // Pass the URL as an iCal URL to associate

      // Set a flag to force reload in Calendar
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }

      // Update the UI
      toast.success(`Listing "${newName}" added successfully`);
      
      // Reload to get the new listing with its feeds
      await loadFeeds();

      // Reset form
      setNewUrl('');
      setNewName('');
      setNewColor(listingColors[0]);
      setNewHours(2.0);
      setNewBankAccount(undefined);
    } catch (error) {
      console.error('Error adding listing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add listing');
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare to remove a feed
  const confirmRemoveListing = (id: string) => {
    setListingToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Remove a feed
  const removeListing = async () => {
    if (!listingToDelete) return;
    
    try {
      console.log(`Deleting listing ${listingToDelete} - this will cascade to:
        - Delete associated listing_ical_feeds records
        - Delete associated events
        - Delete cleaner_assignments for those events`);
      
      // Delete the listing (this will cascade delete all related records)
      await deleteListing(listingToDelete);
      
      // Update local state
      setListings(listings.filter(listing => listing.id !== listingToDelete));
      
      toast.success('Listing and all associated data removed');
      
      // Close the dialog
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    } catch (error) {
      console.error('Error removing listing:', error);
      toast.error('Failed to remove listing and associated data');
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  // Toggle feed active status
  const toggleFeedStatus = async (id: string) => {
    try {
      const feed = feeds.find(f => f.id === id);
      if (!feed) return;
      
      const newStatus = !feed.is_active;
      const updatedFeed = await updateIcalFeed(id, { 
        is_active: newStatus
      });
      
      // Find any matching listings with the same external ID pattern and update their status
      // Note: For listings, we don't have an is_active field directly,
      // but we can control this by updating the color (null = inactive, original color = active)
      try {
        const listings = await getListings();
        const feedExternalId = feed.external_id;
        const matchingListing = listings.find(listing => 
          listing.external_id === `listing-${feedExternalId}` || 
          listing.external_id.includes(feedExternalId)
        );
        
        if (matchingListing) {
          // If the feed is not active, set listing color to null, otherwise restore the feed color
          await updateListing(matchingListing.id, {
            color: newStatus ? feed.color : null
          });
        }
      } catch (listingError) {
        console.error('Error updating corresponding listing status:', listingError);
      }
      
      // Set a flag to force reload in Calendar
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }
      
      const updatedFeeds = feeds.map(f => 
        f.id === id ? updatedFeed : f
      );
      
      setFeeds(updatedFeeds);
      toast.success(`Listing ${!newStatus ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error('Error toggling feed status:', error);
      toast.error('Failed to update listing status');
    }
  };

  // Start editing a feed
  const startEditing = (listing: Listing) => {
    setEditingId(listing.id);
    setEditName(listing.name);
    setEditColor(listing.color || '#000000');
    setEditHours(listing.hours || 2.0);
    setEditBankAccount(listing.bank_account === null ? undefined : listing.bank_account);
    
    // Load feeds for this listing
    const feeds = listingFeeds[listing.id] || [];
    setEditFeeds([...feeds]);
  };

  // Update saveEdit to work with listings
  const saveEdit = async (listingId: string) => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      toast.loading('Saving changes...', { id: 'save-changes' });
      
      // Step 1: Update the listing in the listings table
      await updateListing(listingId, {
        name: editName,
        color: editColor,
        hours: editHours,
        bank_account: editBankAccount || null
      });
      
      // Step 2: Handle feed associations
      
      // First get all existing feed associations for this listing
      const { data: existingAssociations, error: assocError } = await supabase
        .from('listing_ical_feeds')
        .select('*')
        .eq('listing_id', listingId);
      
      if (assocError) throw assocError;
      
      // Get the current feeds for this listing
      const currentFeeds = listingFeeds[listingId] || [];
      
      // Get IDs of existing feeds associated with this listing
      const existingFeedIds = currentFeeds.map(f => f.id);
      
      // Get IDs of feeds that should be associated (excluding temp IDs)
      const keepFeedIds = editFeeds
        .filter(f => !f.id.startsWith('temp-'))
        .map(f => f.id);
      
      // Find feeds to remove (in existing but not in keep)
      const feedsToRemove = existingFeedIds.filter(id => !keepFeedIds.includes(id));
      
      // Find feeds to add (in keep but not in existing)
      const feedsToAdd = keepFeedIds.filter(id => !existingFeedIds.includes(id));
      
      // Handle new feeds with temp IDs
      const newFeedsToCreate = editFeeds.filter(f => f.id.startsWith('temp-'));
      
      // Step 3: Remove associations for feeds that were deleted
      for (const feedId of feedsToRemove) {
        await supabase
          .from('listing_ical_feeds')
          .delete()
          .match({ listing_id: listingId, ical_feed_id: feedId });
        
        console.log(`Removed association between listing ${listingId} and feed ${feedId}`);
      }
      
      // Step 4: Add associations for feeds that were added
      for (const feedId of feedsToAdd) {
        await supabase
          .from('listing_ical_feeds')
          .insert({ listing_id: listingId, ical_feed_id: feedId });
        
        console.log(`Added association between listing ${listingId} and feed ${feedId}`);
      }
      
      // Step 5: Create new feeds and associate them
      for (const newFeed of newFeedsToCreate) {
        const externalId = `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const { data: createdFeed, error: createError } = await supabase
          .from('ical_feeds')
          .insert({
            external_id: externalId,
            url: newFeed.url,
            name: `${editName} Feed`,
            is_active: true,
            color: editColor,
            last_synced: null
          })
          .select();
        
        if (createError) throw createError;
        
        if (createdFeed && createdFeed.length > 0) {
          // Associate the new feed with the listing
          await supabase
            .from('listing_ical_feeds')
            .insert({ listing_id: listingId, ical_feed_id: createdFeed[0].id });
          
          console.log(`Created new feed ${createdFeed[0].id} and associated with listing ${listingId}`);
        }
      }
      
      // Step 6: Update local state and refresh data
      await loadFeeds();
      
      setEditingId(null);
      toast.success('Listing and feeds updated successfully', { id: 'save-changes' });
    } catch (error) {
      console.error('Error updating listing and feeds:', error);
      toast.error(`Failed to update: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'save-changes' });
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
  };

  // Sync all feeds
  const syncAllFeeds = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    toast.loading('Syncing calendar data...', { id: 'sync-all' });
    
    try {
      // Make a single API call to sync all feeds
      const response = await fetch('/api/sync-ical-feeds', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync data');
      }
      
      // Update local state
      if (result.feeds) {
        setFeeds(result.feeds);
      }
      
      // Update last sync time
      const now = new Date().toISOString();
      setLastSync(now);
      await saveLastSync(now);
      
      // Set a flag to force reload in Calendar
      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }
      
      toast.success(`Synced ${result.processedCount || 0} listings successfully`, { id: 'sync-all' });
    } catch (error) {
      console.error('Error syncing all feeds:', error);
      toast.error('Failed to sync calendar data', { id: 'sync-all' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Format a timeago string
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffSeconds < 60) {
        return 'just now';
      } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffSeconds < 86400) {
        const hours = Math.floor(diffSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      }
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Fix the openFeedsManager function to properly handle the listings variable
  const openFeedsManager = (feedId: string) => {
    // First find the feed
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) {
      toast.error("Could not find feed details");
      return;
    }
    
    // Then find any listing associated with this feed
    const matchingListing = listings.find(l => 
      l.external_id === `listing-${feed.external_id}` || 
      l.external_id.includes(feed.external_id)
    );
    
    if (matchingListing) {
      setSelectedListing(matchingListing);
      setManageFeedsDialogOpen(true);
    } else {
      toast.error("Could not find listing details for this feed");
    }
  };

  // Handle feeds manager update
  const handleFeedsManagerUpdate = () => {
    loadFeeds(); // Reload all feeds after changes
  };

  // Add a utility function to get base name from listing name
  const getBaseName = (name: string): string => {
    if (!name) return 'Unknown';
    const parts = name.split('.');
    return parts.length > 1 ? parts[0] : name;
  };

  // Fix the groupListingsByBaseName function to work with listings and sort by number
  const groupListingsByBaseName = (listings: Listing[]): Record<string, Listing[]> => {
    const groups: Record<string, Listing[]> = {};
    
    listings.forEach(listing => {
      const baseName = getBaseName(listing.name);
      if (!groups[baseName]) {
        groups[baseName] = [];
      }
      groups[baseName].push(listing);
    });
    
    // Sort each group by the number after the dot
    Object.keys(groups).forEach(baseName => {
      groups[baseName].sort((a, b) => {
        // Extract the part after the dot for both listings
        const aNameParts = a.name.split('.');
        const bNameParts = b.name.split('.');
        
        // If either doesn't have a part after the dot, use string comparison
        if (aNameParts.length <= 1 || bNameParts.length <= 1) {
          return a.name.localeCompare(b.name);
        }
        
        // Try to parse the parts after the dot as numbers
        const aValue = parseFloat(aNameParts[1]);
        const bValue = parseFloat(bNameParts[1]);
        
        // If both are valid numbers, sort numerically
        if (!isNaN(aValue) && !isNaN(bValue)) {
          return aValue - bValue;
        }
        
        // Otherwise sort alphabetically
        return aNameParts[1].localeCompare(bNameParts[1]);
      });
    });
    
    return groups;
  };

  // Add a helper function to identify platform from URL
  const getPlatformDetails = (url: string): { name: string; color: string } => {
    const lowercaseUrl = url.toLowerCase();
    
    if (lowercaseUrl.includes('airbnb')) {
      return { name: 'Airbnb', color: 'bg-red-500' };
    } else if (lowercaseUrl.includes('booking')) {
      return { name: 'Booking.com', color: 'bg-blue-600' };
    } else if (lowercaseUrl.includes('vrbo') || lowercaseUrl.includes('homeaway')) {
      return { name: 'Vrbo', color: 'bg-green-500' };
    } else if (lowercaseUrl.includes('expedia')) {
      return { name: 'Expedia', color: 'bg-yellow-500' };
    } else if (lowercaseUrl.includes('tripadvisor')) {
      return { name: 'TripAdvisor', color: 'bg-emerald-600' };
    } else {
      return { name: 'Calendar', color: 'bg-gray-500' };
    }
  };

  // Add the renderListingCard function to replace renderFeedCard
  const renderListingCard = (listing: Listing) => {
    const isEditing = editingId === listing.id;
    const feeds = listingFeeds[listing.id] || [];
    
    if (isEditing) {
      return (
        <div key={listing.id} className="bg-white rounded-lg border shadow-sm p-5 relative">
          <div className="space-y-4">
            <div>
              <Label htmlFor={`edit-name-${listing.id}`}>Listing Name</Label>
              <Input
                id={`edit-name-${listing.id}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Listing Name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor={`edit-color-${listing.id}`}>Listing Color</Label>
              <div className="flex items-center mt-1">
                <input
                  type="color"
                  id={`edit-color-${listing.id}`}
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-16 border rounded cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-500">{editColor}</span>
              </div>
            </div>

                          <div>
                <Label htmlFor={`edit-hours-${listing.id}`}>Cleaning Hours</Label>
                <Input
                  id={`edit-hours-${listing.id}`}
                  type="number"
                  value={editHours}
                  onChange={(e) => setEditHours(parseFloat(e.target.value))}
                  min="0.5"
                  step="0.5"
                  className="mt-1 w-full"
                />
              </div>

              <div>
                <Label htmlFor={`edit-bank-${listing.id}`}>Bank Account</Label>
                <Select 
                  value={editBankAccount}
                  onValueChange={(value) => setEditBankAccount(value === "none" ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not Assigned</SelectItem>
                    <SelectItem value="CU">CU</SelectItem>
                    <SelectItem value="JCB Unit 1">JCB Unit 1</SelectItem>
                    <SelectItem value="JCB Unit 2">JCB Unit 2</SelectItem>
                    <SelectItem value="SWJC">SWJC</SelectItem>
                    <SelectItem value="185 CR">185 CR</SelectItem>
                    <SelectItem value="234 CR">234 CR</SelectItem>
                    <SelectItem value="Sofia 378">Sofia 378</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* iCal Feeds Section */}
            <div className="pt-3 mt-3 border-t">
              <Label className="text-md font-medium">Calendar Feeds</Label>
              <div className="mt-2">
                {editFeeds.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editFeeds.map(feed => (
                      <div key={feed.id} className="flex items-center justify-between border rounded p-2 text-sm">
                        <div className="truncate flex-1">{feed.url}</div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => removeEditFeed(feed.id)}
                          className="text-red-500 ml-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No feeds added</p>
                )}

                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add iCal URL"
                    value={newEditFeedUrl}
                    onChange={(e) => setNewEditFeedUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={addEditFeed}
                    disabled={!newEditFeedUrl}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={cancelEdit}
              >
                Cancel
              </Button>
              <Button 
                size="sm"
                onClick={() => saveEdit(listing.id)}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={listing.id} className="bg-white rounded-lg border shadow-sm p-5 relative">
        <div 
          className="absolute top-0 left-0 h-2 w-full rounded-t-lg" 
          style={{ backgroundColor: listing.color || '#888' }}
        ></div>
        <div className="pt-2">
          <h3 className="font-medium text-lg truncate">{listing.name}</h3>
          {feeds.length > 0 ? (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-1">
                {feeds.map((feed, index) => {
                  const { name, color } = getPlatformDetails(feed.url);
                  return (
                    <Badge key={feed.id} className={`${color} text-white text-xs`}>
                      {name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">No feeds configured</p>
          )}
          
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <div>Cleaning Hours: {listing.hours || 2.0}</div>
            <div>Bank Account: {listing.bank_account || 'Not Assigned'}</div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEditing(listing)}
              className="text-blue-500"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => confirmRemoveListing(listing.id)}
              className="text-red-500"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Add the removeEditFeed function
  const removeEditFeed = (feedId: string) => {
    setEditFeeds(editFeeds.filter(feed => feed.id !== feedId));
  };

  // Add the addEditFeed function
  const addEditFeed = async () => {
    if (!newEditFeedUrl) return;
    
    try {
      // For simplicity, we'll just add to the local state for now
      // The actual API call will happen on save
      const tempId = `temp-${Date.now()}`;
      setEditFeeds([...editFeeds, {
        id: tempId,
        external_id: '',
        url: newEditFeedUrl,
        name: `New Feed`,
        last_synced: null,
        is_active: true,
        color: editColor || null,
        created_at: ''
      }]);
      setNewEditFeedUrl('');
    } catch (error) {
      console.error('Error adding feed:', error);
      toast.error('Failed to add feed');
    }
  };

  // Remove the old grouping functions and update the renderGroupedListings function
  const renderGroupedListings = () => {
    const groupedListings = groupListingsByName(listings);
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(groupedListings).map(([baseName, listingsInGroup]) => {
          // Determine if this is a multi-listing group
          const isMultiListingGroup = listingsInGroup.length > 1;
          
          return (
            <div 
              key={baseName} 
              className={`rounded-lg bg-gray-50 p-4 ${isMultiListingGroup ? 'col-span-full' : ''}`}
            >
              <h3 className="text-xl font-bold mb-4 border-b pb-2">{baseName}</h3>
              <div className={`${isMultiListingGroup ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : ''}`}>
                {listingsInGroup.map(listing => (
                  <div key={listing.id}>
                    {renderListingCard(listing)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
            <p className="text-muted-foreground">
              Manage your rental properties and their calendar connections.
            </p>
          </div>
        </div>

        {/* Manual Add */}
        <Card>
          <CardHeader>
            <CardTitle>Add a New Listing</CardTitle>
            <CardDescription>
              Add a new property by connecting its calendar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-1">
                  <Label htmlFor="listing-name">Listing Name</Label>
                  <Input
                    id="listing-name"
                    placeholder="Beach House"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ical-url">iCal URL</Label>
                  <Input
                    id="ical-url"
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="listing-color">Color</Label>
                  <input
                    id="listing-color"
                    type="color"
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    className="h-9 w-16 border rounded cursor-pointer mt-1"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="listing-hours">Cleaning Hours</Label>
                  <Input
                    id="listing-hours"
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newHours}
                    onChange={e => setNewHours(parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="bank-account">Bank Account</Label>
                  <Select 
                    value={newBankAccount}
                    onValueChange={(value) => setNewBankAccount(value === "none" ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                                      <SelectContent>
                    <SelectItem value="none">Not Assigned</SelectItem>
                    <SelectItem value="CU">CU</SelectItem>
                    <SelectItem value="JCB Unit 1">JCB Unit 1</SelectItem>
                    <SelectItem value="JCB Unit 2">JCB Unit 2</SelectItem>
                    <SelectItem value="SWJC">SWJC</SelectItem>
                    <SelectItem value="185 CR">185 CR</SelectItem>
                    <SelectItem value="234 CR">234 CR</SelectItem>
                    <SelectItem value="Sofia 378">Sofia 378</SelectItem>
                  </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end md:col-span-1">
                  <Button
                    className="w-full"
                    onClick={addListing}
                    disabled={isLoading || !newUrl || !newName}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Listing
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Listings</CardTitle>
                <CardDescription>
                  Manage your listings and their calendar connections.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No listings added yet. Add your first one above.
              </div>
            ) : (
              renderGroupedListings()
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this listing? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center p-4 border rounded-md bg-red-50 text-red-800 gap-2 my-4">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium">Warning:</p>
                <p className="text-sm">Deleting this listing will remove all associated calendar data and cleaner assignments.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={removeListing}>
                Delete Listing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add this dialog to render the ListingFeedsManager */}
        <Dialog 
          open={manageFeedsDialogOpen} 
          onOpenChange={(open) => {
            setManageFeedsDialogOpen(open);
            if (!open) setSelectedListing(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Calendar Feeds</DialogTitle>
              <DialogDescription>
                Add or remove calendar feeds for this listing. Multiple feeds will be combined.
              </DialogDescription>
            </DialogHeader>
            
            {selectedListing && (
              <ListingFeedsManager
                listingId={selectedListing.id}
                listingName={selectedListing.name}
                listingColor={selectedListing.color}
                onUpdate={handleFeedsManagerUpdate}
              />
            )}
            
            <DialogFooter>
              <Button onClick={() => setManageFeedsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function ListingsPage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'sub-admin']}>
      <ListingsPageContent />
    </ProtectedRoute>
  );
} 