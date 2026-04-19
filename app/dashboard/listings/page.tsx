'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  Bell,
  AlertCircle,
  Clock,
  CheckCircle2,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  LayoutGrid,
  List,
  RefreshCw,
  Check,
  X,
  Loader2,
  Car,
  Brush,
  Repeat2,
  KeyRound,
  Shield,
  CalendarDays,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import {
  getIcalFeedsForListing,
  getListings,
  createListing,
  updateListing,
  deleteListing,
  toggleListingActive,
  isListingActive,
  toggleListingVisibility,
} from '@/lib/models';
import { IcalFeed, Listing } from '@/lib/models';
import { groupListingsByName } from '@/lib/utils';
import { applyListingIcalUrlChanges, sortFeedsForDisplay } from '@/lib/listing-ical-urls';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SummaryData {
  summary: {
    total_listings: number;
    active_listings_count: number;
    total_cleanings_this_month: number;
    cleans_this_week: number;
    cleans_today: number;
    ops_reminders_count: number;
    total_reminders: number;
    active_issues: number;
  };
  reminders: {
    overdue: any[];
    due_soon: any[];
    upcoming: any[];
  };
  certificate_expiry_reminders: any[];
  parking_reminders: any[];
  early_checkin_reminders: any[];
  bin_collection_reminders: any[];
  maintenance_issues: any[];
  property_key_data: any[];
  listing_activity: any[];
  listing_activity_week: any[];
  listing_activity_day: any[];
  period: {
    month: number;
    year: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const listingColors = [
  '#4f46e5', '#ef4444', '#10b981', '#f59e0b',
  '#6366f1', '#ec4899', '#06b6d4', '#8b5cf6',
  '#f97316', '#14b8a6',
];

const bankAccounts = ['CU', 'JCB Unit 1', 'JCB Unit 2', 'SWJC', '185 CR', '234 CR', 'Sofia 378'];

function convertTo12Hour(time24: string): string {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${minutes} ${period}`;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function ListingsDashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const listingsRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date();

  // ── Summary / period state ────────────────────────────────────────────────
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [cleansPeriod, setCleansPeriod] = useState<'week' | 'month'>('week');
  const [activityPeriod, setActivityPeriod] = useState<'month' | 'week' | 'day'>('month');

  // ── Listings state ────────────────────────────────────────────────────────
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingFeeds, setListingFeeds] = useState<Record<string, IcalFeed[]>>({});
  const [listingActiveStatus, setListingActiveStatus] = useState<Record<string, boolean>>({});
  const [listingStats, setListingStats] = useState<Record<string, any>>({});
  const [isListingsLoading, setIsListingsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Property Key Data state ───────────────────────────────────────────────
  const [showKeyData, setShowKeyData] = useState(false);

  // ── Dialog / form state ───────────────────────────────────────────────────
  const [addListingDialogOpen, setAddListingDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<string | null>(null);
  // ── Add listing form ──────────────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUrl2, setNewUrl2] = useState('');
  const [newColor, setNewColor] = useState(listingColors[0]);
  const [newHours, setNewHours] = useState(2.0);
  const [newBankAccount, setNewBankAccount] = useState<string | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false);

  // ── Edit listing form ─────────────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editHours, setEditHours] = useState(2.0);
  const [editBankAccount, setEditBankAccount] = useState<string | undefined>(undefined);
  const [editUrl1, setEditUrl1] = useState('');
  const [editUrl2, setEditUrl2] = useState('');
  const [editExtraFeedCount, setEditExtraFeedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // ── Permission check ──────────────────────────────────────────────────────
useEffect(() => {
  if (!loading && user) {
    const ok = user.role === 'admin' || user.role === 'sub-admin';
    if (!ok) {
      router.push('/dashboard');
      toast.error('You do not have permission to access this page');
    }
  }
}, [user, loading, router]);

  // ── Load summary ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadSummary();
  }, [selectedMonth, selectedYear]);

  // ── Load listings on mount ────────────────────────────────────────────────
  useEffect(() => {
    loadListingsData();
  }, []);

  // ── Sync listing stats from summaryData ──────────────────────────────────
  useEffect(() => {
    if (summaryData?.listing_activity) {
      const stats: Record<string, any> = {};
      summaryData.listing_activity.forEach((listing: any) => {
        stats[listing.id] = {
          cleanings: listing.cleanings_this_month,
          hours: listing.hours_this_month,
          lastActivity: listing.last_cleaning_date,
        };
      });
      setListingStats(stats);
    }
  }, [summaryData]);

  useEffect(() => {
    if (!editDialogOpen || !editingListing) return;
    let cancelled = false;
    (async () => {
      try {
        const feeds = sortFeedsForDisplay(await getIcalFeedsForListing(editingListing.id));
        if (cancelled) return;
        setEditUrl1(feeds[0]?.url ?? '');
        setEditUrl2(feeds[1]?.url ?? '');
        setEditExtraFeedCount(Math.max(0, feeds.length - 2));
      } catch (e) {
        console.error('Error loading feeds for edit:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editDialogOpen, editingListing?.id]);

  const loadSummary = async () => {
    setIsSummaryLoading(true);
    try {
      const response = await fetch(
        `/api/listings/summary?month=${selectedMonth}&year=${selectedYear}`
      );
      const data = await response.json();
      if (data.success) {
        setSummaryData(data);
      } else {
        toast.error('Failed to load summary data');
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      toast.error('Failed to load summary data');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const loadListingsData = async () => {
    setIsListingsLoading(true);
    try {
      const listingsData = await getListings();
      setListings(listingsData);

      const feedsMap: Record<string, IcalFeed[]> = {};
      const activeStatusMap: Record<string, boolean> = {};

      for (const listing of listingsData) {
        try {
          const feeds = await getIcalFeedsForListing(listing.id);
          feedsMap[listing.id] = feeds;
          activeStatusMap[listing.id] = isListingActive(feeds);
        } catch (err) {
          console.error(`Error loading feeds for listing ${listing.id}:`, err);
          feedsMap[listing.id] = [];
          activeStatusMap[listing.id] = false;
        }
      }

      setListingFeeds(feedsMap);
      setListingActiveStatus(activeStatusMap);
    } catch (error) {
      console.error('Error loading listings:', error);
      toast.error('Failed to load listings');
    } finally {
      setIsListingsLoading(false);
    }
  };

  // ─── Formatting helpers ───────────────────────────────────────────────────

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  /** "Today" | "Yesterday" | "DD-MM-YYYY" */
  const formatLastClean = (dateString: string | null): string => {
    if (!dateString) return 'No activity';
    try {
      const date = new Date(dateString);
      if (isToday(date)) return 'Today';
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'dd-MM-yyyy');
    } catch {
      return 'N/A';
    }
  };

  const formatDaysUntil = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) return `${Math.abs(diff)}d overdue`;
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Tomorrow';
      return `In ${diff} days`;
    } catch {
      return 'N/A';
    }
  };

  const formatCertDays = (days: number): string => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    return `In ${days} days`;
  };

  const certBadgeStyle = (days: number) => {
    if (days < 0) return 'bg-red-100 text-red-800 border-red-200';
    if (days <= 30) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const certRowStyle = (days: number) => {
    if (days < 0) return 'border-l-4 border-red-500 bg-red-50';
    if (days <= 30) return 'border-l-4 border-orange-400 bg-orange-50';
    return 'border-l-4 border-yellow-400 bg-yellow-50';
  };

  // ─── Listings CRUD ────────────────────────────────────────────────────────

  const addListing = async () => {
    if (!newName.trim()) {
      toast.error('Please enter a listing name');
      return;
    }
    if (!newUrl.trim()) {
      toast.error('Please enter an iCal URL');
      return;
    }

    const u2 = newUrl2.trim();
    if (u2 && u2 === newUrl.trim()) {
      toast.error('The two iCal URLs must be different');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to validate iCal URL');

      if (u2) {
        const r2 = await fetch('/api/fetch-ical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u2 }),
        });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error || 'Failed to validate second iCal URL');
      }

      const colorIndex = listings.length % listingColors.length;
      const color = newColor || listingColors[colorIndex];
      const externalId = `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const icalUrls = u2 ? [newUrl.trim(), u2] : [newUrl.trim()];

      await createListing(
        {
          external_id: externalId,
          name: newName.trim(),
          color,
          hours: newHours,
          bank_account: newBankAccount || null,
        },
        icalUrls
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }

      toast.success(`Listing "${newName}" added successfully`);
      setNewName('');
      setNewUrl('');
      setNewUrl2('');
      setNewColor(listingColors[0]);
      setNewHours(2.0);
      setNewBankAccount(undefined);
      setAddListingDialogOpen(false);
      await loadListingsData();
      await loadSummary();
    } catch (error) {
      console.error('Error adding listing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add listing');
    } finally {
      setIsAdding(false);
    }
  };

  const startEditing = (listing: Listing) => {
    setEditingListing(listing);
    setEditName(listing.name);
    setEditColor(listing.color || '#4f46e5');
    setEditHours(listing.hours || 2.0);
    setEditBankAccount(listing.bank_account === null ? undefined : listing.bank_account);
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!editingListing) return;
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateListing(editingListing.id, {
        name: editName.trim(),
        color: editColor,
        hours: editHours,
        bank_account: editBankAccount || null,
      });

      if (editUrl1.trim() || editUrl2.trim()) {
        await applyListingIcalUrlChanges({
          listingId: editingListing.id,
          listingName: editName.trim(),
          listingColor: editColor,
          url1: editUrl1,
          url2: editUrl2,
        });

        if (typeof window !== 'undefined') {
          localStorage.setItem('calendar_reload_needed', 'true');
        }
      }

      setListings((prev) =>
        prev.map((l) =>
          l.id === editingListing.id
            ? { ...l, name: editName.trim(), color: editColor, hours: editHours, bank_account: editBankAccount || null }
            : l
        )
      );

      await loadListingsData();

      setEditDialogOpen(false);
      setEditingListing(null);
      toast.success('Listing updated');
    } catch (error) {
      console.error('Error updating listing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update listing');
      await loadListingsData();
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteDialog = (listingId: string) => {
    setListingToDelete(listingId);
    setDeleteDialogOpen(true);
  };

  const removeListing = async () => {
    if (!listingToDelete) return;
    try {
      await deleteListing(listingToDelete);
      setListings((prev) => prev.filter((l) => l.id !== listingToDelete));
      toast.success('Listing deleted');
      setDeleteDialogOpen(false);
      setListingToDelete(null);
      await loadSummary();
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast.error('Failed to delete listing');
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  const toggleListingStatus = async (listingId: string) => {
    const currentStatus = listingActiveStatus[listingId] !== false;
    const newStatus = !currentStatus;

    try {
      await toggleListingActive(listingId, newStatus);

      setListingActiveStatus((prev) => ({ ...prev, [listingId]: newStatus }));

      const feeds = listingFeeds[listingId] || [];
      setListingFeeds((prev) => ({
        ...prev,
        [listingId]: feeds.map((f) => ({ ...f, is_active: newStatus })),
      }));

      const listing = listings.find((l) => l.id === listingId);
      if (listing) {
        const primaryFeed = feeds[0];
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId
              ? { ...l, color: newStatus ? (primaryFeed?.color || '#4f46e5') : null }
              : l
          )
        );
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('calendar_reload_needed', 'true');
      }

      toast.success(`Listing ${newStatus ? 'activated' : 'deactivated'}`);
      await loadSummary();
    } catch (error) {
      console.error('Error toggling listing status:', error);
      toast.error('Failed to update listing status');
    }
  };

  const handleToggleVisibility = async (listingId: string, currentlyHidden: boolean) => {
    try {
      await toggleListingVisibility(listingId, !currentlyHidden);
      setListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, is_hidden: !currentlyHidden } : l))
      );
      toast.success(!currentlyHidden ? 'Listing hidden from dropdowns' : 'Listing visible in dropdowns');
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update listing visibility');
    }
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading || isSummaryLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 bg-gray-200 rounded" />
            <div className="h-72 bg-gray-200 rounded" />
          </div>
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // ─── Listings grid/list views ─────────────────────────────────────────────

  const renderGridView = () => {
    const groupedListings = groupListingsByName(listings);
    return (
      <div className="space-y-6">
        {Object.entries(groupedListings).map(([groupName, groupListings]) => (
          <div key={groupName} className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border-l-4 border-gray-900">
              <span className="font-semibold text-gray-900 text-sm">{groupName}</span>
              <Badge variant="outline" className="text-xs">
                {(groupListings as Listing[]).length} unit{(groupListings as Listing[]).length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {(groupListings as Listing[]).map((listing) => {
                const isActive = listingActiveStatus[listing.id] !== false;
                const feeds = listingFeeds[listing.id] || [];
                const stats = listingStats[listing.id];

                return (
                  <Card
                    key={listing.id}
                    className={`relative transition-all hover:shadow-md cursor-pointer ${
                      listing.is_hidden ? 'opacity-60' : ''
                    } ${!isActive ? 'border-dashed' : ''}`}
                    onClick={() => router.push(`/dashboard/listings/${listing.id}`)}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                      style={{ backgroundColor: listing.color || '#e5e7eb' }}
                    />
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-sm font-semibold truncate">
                            {listing.name}
                          </CardTitle>
                          {listing.bank_account && (
                            <p className="text-xs text-gray-500 mt-0.5">{listing.bank_account}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={isActive ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleListingStatus(listing.id)}
                          >
                            {isActive ? (
                              <Power className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <PowerOff className="h-3.5 w-3.5 text-gray-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title={listing.is_hidden ? 'Show listing' : 'Hide listing'}
                            onClick={() => handleToggleVisibility(listing.id, listing.is_hidden || false)}
                          >
                            {listing.is_hidden ? (
                              <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3 space-y-2">
                      {/* Status badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          className={`text-xs ${
                            isActive
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </Badge>
                        {listing.is_hidden && (
                          <Badge className="text-xs bg-gray-100 text-gray-500 border-gray-200">
                            Hidden
                          </Badge>
                        )}
                      </div>

                      {/* Stats grid: cleans this month + total hours */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-gray-50 rounded-md px-2.5 py-1.5">
                          <p className="text-xs text-gray-400 leading-none mb-0.5">Cleans (month)</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {stats?.cleanings ?? 0}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-md px-2.5 py-1.5">
                          <p className="text-xs text-gray-400 leading-none mb-0.5">Hours (month)</p>
                          <p className="text-sm font-semibold text-gray-900">
                            {typeof stats?.hours === 'number' ? stats.hours.toFixed(1) : '0.0'}h
                          </p>
                        </div>
                      </div>

                      {/* Calendar feeds count */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        <span>{feeds.length} calendar feed{feeds.length !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Access code (masked by default) */}
                      {listing.access_code && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <KeyRound className="h-3 w-3 text-gray-400" />
                          <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">
                            ••••••
                          </span>
                          <span className="text-gray-400">access code on file</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => router.push(`/dashboard/listings/${listing.id}`)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => startEditing(listing)}
                          title="Edit listing"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(listing.id)}
                          title="Delete listing"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderListView = () => {
    const groupedListings = groupListingsByName(listings);
    return (
      <div className="space-y-4">
        {Object.entries(groupedListings).map(([groupName, groupListings]) => (
          <div key={groupName}>
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-t-lg border-l-4 border-gray-900 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{groupName}</span>
              <Badge variant="outline" className="text-xs">
                {(groupListings as Listing[]).length}
              </Badge>
            </div>
            <div className="border rounded-b-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Cleans</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Hours</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Bank</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(groupListings as Listing[]).map((listing) => {
                    const isActive = listingActiveStatus[listing.id] !== false;
                    const stats = listingStats[listing.id];

                    return (
                      <tr
                        key={listing.id}
                        className={`border-b last:border-0 hover:bg-gray-50 ${
                          listing.is_hidden ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: listing.color || '#e5e7eb' }}
                            />
                            <button
                              className="font-medium text-sm hover:underline text-left"
                              onClick={() => router.push(`/dashboard/listings/${listing.id}`)}
                            >
                              {listing.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            className={`text-xs ${
                              isActive
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {stats?.cleanings ?? 0}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {typeof stats?.hours === 'number' ? stats.hours.toFixed(1) : '0.0'}h
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {listing.bank_account || '—'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(listing)}
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={isActive ? 'ghost' : 'secondary'}
                              size="sm"
                              onClick={() => toggleListingStatus(listing.id)}
                              title={isActive ? 'Deactivate' : 'Activate'}
                            >
                              {isActive ? (
                                <Power className="h-4 w-4 text-green-600" />
                              ) : (
                                <PowerOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant={listing.is_hidden ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => handleToggleVisibility(listing.id, listing.is_hidden || false)}
                              title={listing.is_hidden ? 'Show in dropdowns' : 'Hide from dropdowns'}
                            >
                              {listing.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(listing.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Derived values ────────────────────────────────────────────────────────

  const allRemindersEmpty =
    (summaryData?.certificate_expiry_reminders.length || 0) === 0 &&
    (summaryData?.parking_reminders.length || 0) === 0 &&
    (summaryData?.early_checkin_reminders.length || 0) === 0 &&
    (summaryData?.bin_collection_reminders.length || 0) === 0;

  const activityData = (() => {
    const raw: any[] =
      activityPeriod === 'month'
        ? summaryData?.listing_activity ?? []
        : activityPeriod === 'week'
        ? summaryData?.listing_activity_week ?? []
        : summaryData?.listing_activity_day ?? [];

    return raw
      // 1. Hide inactive listings (color === null means deactivated)
      .filter((l: any) => l.color !== null)
      // 2. Listings with activity first, "No activity" ones last.
      //    Stable sort preserves the existing sortListingsByName order within each group.
      .sort((a: any, b: any) => {
        const aActive = (a.cleanings_this_period ?? 0) > 0 ? 0 : 1;
        const bActive = (b.cleanings_this_period ?? 0) > 0 ? 0 : 1;
        return aActive - bActive;
      });
  })();

  const activityPeriodLabel =
    activityPeriod === 'month'
      ? `${months[selectedMonth - 1]} ${selectedYear}`
      : activityPeriod === 'week'
      ? 'This Week'
      : 'Today';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Listings Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview and management of all properties</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setAddListingDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Listing
          </Button>
        </div>
      </div>

      {/* ── Summary Cards (5) ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* 1 — Total Listings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
            <Home className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData?.summary.total_listings ?? 0}</div>
            <p className="text-xs text-gray-500 mt-1">All properties</p>
          </CardContent>
        </Card>

        {/* 2 — Active Listings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
            <Power className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {summaryData?.summary.active_listings_count ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Calendar connected &amp; on</p>
          </CardContent>
        </Card>

        {/* 3 — Cleans This Week / Month (toggle) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {cleansPeriod === 'week' ? 'Cleans This Week' : 'Cleans This Month'}
            </CardTitle>
            <Brush className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {cleansPeriod === 'week'
                ? (summaryData?.summary.cleans_this_week ?? 0)
                : (summaryData?.summary.total_cleanings_this_month ?? 0)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs ${cleansPeriod === 'week' ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                Week
              </span>
              <Switch
                checked={cleansPeriod === 'month'}
                onCheckedChange={(checked) => setCleansPeriod(checked ? 'month' : 'week')}
                className="scale-75"
              />
              <span className={`text-xs ${cleansPeriod === 'month' ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                Month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 4 — Reminders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reminders</CardTitle>
            <Bell className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryData?.summary.ops_reminders_count ?? 0}
              {(summaryData?.summary.ops_reminders_count ?? 0) > 0 && (
                <span className="text-orange-500 ml-1">⚠️</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Certs · parking · check-in · bin</p>
          </CardContent>
        </Card>

        {/* 5 — Issues Repeated */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues Repeated</CardTitle>
            <Repeat2 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summaryData?.summary.active_issues ?? 0}
              {(summaryData?.summary.active_issues ?? 0) > 0 && (
                <span className="text-red-600 ml-1">🔴</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Maintenance reports (30d)</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Widgets: Reminders + Maintenance Issues ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Reminders Widget ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Upcoming Reminders
            </CardTitle>
            <p className="text-xs text-gray-500">
              Certificates · Parking permits · Early check-ins · Bin collection
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {allRemindersEmpty ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="text-sm">No upcoming reminders</p>
                </div>
              ) : (
                <>
                  {/* ── Certificate Expiry ───────────────────────────────── */}
                  {(summaryData?.certificate_expiry_reminders.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shield className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-xs font-semibold text-red-800 uppercase tracking-wide">
                          Certificate Expiry
                        </span>
                      </div>
                      {summaryData?.certificate_expiry_reminders.map((cert: any) => (
                        <div
                          key={cert.id}
                          className={`pl-3 py-2 mb-2 rounded-r ${certRowStyle(cert.days_until_expiry)}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{cert.listing_name}</span>
                                <Badge className={`text-xs ${certBadgeStyle(cert.days_until_expiry)}`}>
                                  {formatCertDays(cert.days_until_expiry)}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {cert.compliance_label}
                                {cert.expiry_date &&
                                  ` · Expires ${format(parseISO(cert.expiry_date), 'dd MMM yyyy')}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-2"
                              onClick={() =>
                                router.push(
                                  `/dashboard/listings/${cert.listing_id}?tab=docs`
                                )
                              }
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Parking Permits ──────────────────────────────────── */}
                  {(summaryData?.parking_reminders.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Car className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                          Parking Permits
                        </span>
                      </div>
                      {summaryData?.parking_reminders.map((p: any) => (
                        <div
                          key={p.id}
                          className={`border-l-4 pl-3 py-2 mb-2 rounded-r ${
                            p.permit_status === 'permit_os'
                              ? 'border-red-500 bg-red-50'
                              : 'border-orange-400 bg-orange-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{p.listing_name}</span>
                                <Badge
                                  className={
                                    p.permit_status === 'permit_os'
                                      ? 'bg-red-100 text-red-800 border-red-200 text-xs'
                                      : 'bg-orange-100 text-orange-800 border-orange-200 text-xs'
                                  }
                                >
                                  {p.permit_status === 'permit_os' ? 'Permit Outstanding' : 'Payment Pending'}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">
                                Check-in: {p.check_in_date ? formatDate(p.check_in_date) : 'N/A'}
                                {p.vehicle_registration && ` · ${p.vehicle_registration}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-2"
                              onClick={() => router.push('/dashboard/early-parking')}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Early Check-ins ───────────────────────────────────── */}
                  {(summaryData?.early_checkin_reminders.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">
                          Early Check-ins
                        </span>
                      </div>
                      {summaryData?.early_checkin_reminders.map((ec: any) => (
                        <div
                          key={ec.id}
                          className="border-l-4 border-purple-400 bg-purple-50 pl-3 py-2 mb-2 rounded-r"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{ec.listing_name}</span>
                                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                                  {formatDaysUntil(ec.check_in_date)}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {ec.check_in_date ? formatDate(ec.check_in_date) : 'N/A'}
                                {ec.requested_time && ` · Requested: ${convertTo12Hour(ec.requested_time)}`}
                                {ec.booking_platform && ` · ${ec.booking_platform}`}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-2"
                              onClick={() => router.push('/dashboard/early-parking')}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Bin Collection ────────────────────────────────────── */}
                  {(summaryData?.bin_collection_reminders.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <AlertCircle className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-semibold text-green-800 uppercase tracking-wide">
                          Bin Collection
                        </span>
                      </div>
                      {summaryData?.bin_collection_reminders.map((b: any) => (
                        <div
                          key={b.id}
                          className="border-l-4 border-green-400 bg-green-50 pl-3 py-2 mb-2 rounded-r"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{b.listing_name}</span>
                                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                  {formatDaysUntil(b.due_date)}
                                </Badge>
                              </div>
                              {b.title && (
                                <p className="text-xs text-gray-600 mt-0.5">{b.title}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs ml-2"
                              onClick={() =>
                                router.push(`/dashboard/listings/${b.listing_id}`)
                              }
                            >
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Maintenance Issues Widget ─────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat2 className="h-5 w-5" />
              Issues Repeated
            </CardTitle>
            <p className="text-xs text-gray-500">
              Maintenance issues reported by cleaners (last 30 days)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {(summaryData?.maintenance_issues.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
                  <p className="text-sm">No maintenance issues reported</p>
                </div>
              ) : (
                summaryData?.maintenance_issues.map((issue: any) => (
                  <div key={issue.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {issue.listing_name}
                          </span>
                          {issue.damage_reported && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs flex-shrink-0">
                              Damage
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {(() => {
                              try {
                                return format(new Date(issue.reported_at), 'dd-MM-yyyy');
                              } catch {
                                return 'N/A';
                              }
                            })()}
                          </span>
                        </div>
                        {issue.issue && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{issue.issue}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">By: {issue.cleaner_name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs ml-1 flex-shrink-0"
                        onClick={() => router.push('/dashboard/cleaner-reports')}
                      >
                        Report
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Property Key Data ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Property Key Data
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Today's checkouts — address &amp; access details
              </p>
            </div>
            {(summaryData?.property_key_data.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKeyData((prev) => !prev)}
                className="flex items-center gap-2"
              >
                {showKeyData ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide Codes
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show Codes
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(summaryData?.property_key_data.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium">No checkouts scheduled for today</p>
              <p className="text-xs text-gray-400 mt-1">
                Properties with checkouts today will appear here with their access details
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaryData?.property_key_data.map((prop: any) => (
                <div
                  key={prop.listing_id}
                  className="border rounded-lg p-4 bg-gray-50 hover:bg-white transition-colors"
                >
                  {/* Listing name */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="font-semibold text-sm text-gray-900">{prop.listing_name}</span>
                  </div>

                  {/* Address */}
                  {prop.address ? (
                    <p className="text-xs text-gray-600 mb-3 pl-4">
                      📍 {prop.address}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mb-3 pl-4 italic">No address on file</p>
                  )}

                  {/* Access codes block */}
                  <div className="pl-4 space-y-1.5">
                    {/* Lock type */}
                    {prop.lock_type && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Lock Type:</span>
                        <span className="font-medium text-gray-700 capitalize">{prop.lock_type}</span>
                      </div>
                    )}

                    {/* Access code (from listings table) */}
                    {prop.access_code && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Access Code:</span>
                        <span className="font-mono font-medium text-gray-700 bg-white border rounded px-1.5 py-0.5">
                          {showKeyData ? prop.access_code : '••••••'}
                        </span>
                      </div>
                    )}

                    {/* Key safe code (from listing_operations) */}
                    {prop.key_safe_code && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Key Safe:</span>
                        <span className="font-mono font-medium text-gray-700 bg-white border rounded px-1.5 py-0.5">
                          {showKeyData ? prop.key_safe_code : '••••••'}
                        </span>
                      </div>
                    )}

                    {/* Spare key location */}
                    {prop.spare_key_location && (
                      <div className="flex items-start gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Spare Key:</span>
                        <span className="font-medium text-gray-700">{prop.spare_key_location}</span>
                      </div>
                    )}

                    {/* Parking access code */}
                    {prop.parking_access_code && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Parking:</span>
                        <span className="font-mono font-medium text-gray-700 bg-white border rounded px-1.5 py-0.5">
                          {showKeyData ? prop.parking_access_code : '••••••'}
                        </span>
                      </div>
                    )}

                    {/* Gate code */}
                    {prop.gate_code && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-24 flex-shrink-0">Gate Code:</span>
                        <span className="font-mono font-medium text-gray-700 bg-white border rounded px-1.5 py-0.5">
                          {showKeyData ? prop.gate_code : '••••••'}
                        </span>
                      </div>
                    )}

                    {/* Access instructions */}
                    {prop.access_instructions && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-gray-500 mb-0.5">Instructions:</p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          {prop.access_instructions}
                        </p>
                      </div>
                    )}

                    {/* If no code data at all */}
                    {!prop.access_code &&
                      !prop.key_safe_code &&
                      !prop.spare_key_location &&
                      !prop.parking_access_code &&
                      !prop.gate_code &&
                      !prop.lock_type && (
                        <p className="text-xs text-gray-400 italic">
                          No access codes on file — add them in the listing profile
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Activity Table ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>📊 Activity</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Cleanings &amp; hours — {activityPeriodLabel}
              </p>
            </div>
            {/* Month / Week / Day toggle */}
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-gray-50">
              {(['month', 'week', 'day'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setActivityPeriod(period)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activityPeriod === period
                      ? 'bg-white text-gray-900 shadow-sm border'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activityData.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No activity data for this period
            </div>
          ) : (
            /* Single table inside the scroll container — header stays sticky */
            <div className="max-h-[540px] overflow-y-auto overflow-x-auto border rounded-lg">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wide w-[35%]">
                      Listing
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wide w-[15%]">
                      Cleanings
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wide w-[15%]">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wide w-[20%]">
                      Last Clean
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wide w-[15%]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activityData.map((listing: any) => (
                    <tr key={listing.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 w-[35%]">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: listing.color || '#e5e7eb' }}
                          />
                          <span className="font-medium text-sm">{listing.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm w-[15%]">
                        <span
                          className={
                            listing.cleanings_this_period > 0
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-400'
                          }
                        >
                          {listing.cleanings_this_period}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm w-[15%]">
                        <span
                          className={
                            listing.hours_this_period > 0 ? 'text-gray-700' : 'text-gray-400'
                          }
                        >
                          {typeof listing.hours_this_period === 'number'
                            ? listing.hours_this_period.toFixed(1)
                            : '0.0'}
                          h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm w-[20%]">
                        <span
                          className={
                            listing.last_cleaning_date
                              ? isToday(new Date(listing.last_cleaning_date))
                                ? 'text-green-600 font-medium'
                                : 'text-gray-600'
                              : 'text-gray-400'
                          }
                        >
                          {formatLastClean(listing.last_cleaning_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right w-[15%]">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => router.push(`/dashboard/listings/${listing.id}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── All Listings Section ────────────────────────────────────────────── */}
      <div ref={listingsRef}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>
                  Your Listings{listings.length > 0 ? ` (${listings.length})` : ''}
                </CardTitle>
                <CardDescription>
                  {viewMode === 'grid'
                    ? 'Browse your properties in card view'
                    : 'View all properties in table format'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isListingsLoading && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Loading…
                  </span>
                )}
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={loadListingsData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {listings.length === 0 && !isListingsLoading ? (
              <div className="text-center py-16 text-gray-500">
                <Home className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-xl font-medium mb-2">No listings yet</p>
                <p className="text-sm mb-4">Add your first property to get started</p>
                <Button onClick={() => setAddListingDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Listing
                </Button>
              </div>
            ) : (
              viewMode === 'grid' ? renderGridView() : renderListView()
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Add New Listing Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={addListingDialogOpen}
        onOpenChange={(open) => {
          setAddListingDialogOpen(open);
          if (!open) {
            setNewName('');
            setNewUrl('');
            setNewUrl2('');
            setNewColor(listingColors[0]);
            setNewHours(2.0);
            setNewBankAccount(undefined);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Listing</DialogTitle>
            <DialogDescription>
              Add a new property by connecting its iCal calendar feed (one or two URLs).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-name">Listing Name</Label>
              <Input
                id="new-name"
                placeholder="e.g. Beach House.1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-url">Primary iCal URL</Label>
              <Input
                id="new-url"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-url-2">Second iCal URL (optional)</Label>
              <Input
                id="new-url-2"
                placeholder="Optional second calendar (e.g. another platform)"
                value={newUrl2}
                onChange={(e) => setNewUrl2(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-color">Colour</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    id="new-color"
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-9 w-14 border rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-500">{newColor}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="new-hours">Cleaning Hours</Label>
                <Input
                  id="new-hours"
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={newHours}
                  onChange={(e) => setNewHours(parseFloat(e.target.value) || 2)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-bank">Bank Account</Label>
              <Select
                value={newBankAccount}
                onValueChange={(v) => setNewBankAccount(v === 'none' ? undefined : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Assigned</SelectItem>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba} value={ba}>{ba}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddListingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addListing} disabled={isAdding || !newName.trim() || !newUrl.trim()}>
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Listing
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Listing Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingListing(null);
            setEditUrl1('');
            setEditUrl2('');
            setEditExtraFeedCount(0);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
            <DialogDescription>Update details for {editingListing?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="edit-name">Listing Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>
            {editExtraFeedCount > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                This listing has {editExtraFeedCount} additional calendar feed
                {editExtraFeedCount !== 1 ? 's' : ''} beyond the first two. Only the first two slots
                are edited here.
              </p>
            )}
            <div>
              <Label htmlFor="edit-ical-1">Primary iCal URL</Label>
              <Input
                id="edit-ical-1"
                placeholder="https://www.airbnb.com/calendar/ical/..."
                value={editUrl1}
                onChange={(e) => setEditUrl1(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-ical-2">Second iCal URL (optional)</Label>
              <Input
                id="edit-ical-2"
                placeholder="Optional second calendar"
                value={editUrl2}
                onChange={(e) => setEditUrl2(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-color">Colour</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  id="edit-color"
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="h-9 w-14 border rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">{editColor}</span>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-hours">Cleaning Hours</Label>
              <Input
                id="edit-hours"
                type="number"
                value={editHours}
                onChange={(e) => setEditHours(parseFloat(e.target.value) || 2)}
                min="0.5"
                step="0.5"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-bank">Bank Account</Label>
              <Select
                value={editBankAccount}
                onValueChange={(v) => setEditBankAccount(v === 'none' ? undefined : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Assigned</SelectItem>
                  {bankAccounts.map((ba) => (
                    <SelectItem key={ba} value={ba}>{ba}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ──────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              This will permanently delete the listing and all associated calendar data and cleaner assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center p-4 border rounded-md bg-red-50 text-red-800 gap-2 my-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-sm">This action cannot be undone.</p>
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
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function ListingsDashboardPage() {
  return (
    <ProtectedRoute>
      <ListingsDashboardContent />
    </ProtectedRoute>
  );
}
