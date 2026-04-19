'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Listing, ListingOperations, BinCollectionItem } from '@/lib/models';
import { normalizeBinCollectionArray, legacyDayToBinItem } from '@/lib/bin-collection-schedule';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

// Import tab components
import { OverviewTab } from '@/components/listing-profile/OverviewTab';
import { OperationsTab } from '@/components/listing-profile/OperationsTab';
import { DocsComplianceTab } from '@/components/listing-profile/DocsComplianceTab';
import { LPCleanerListTab } from '@/components/listing-profile/LPCleanerListTab';
import { FinanceOwnerTab } from '@/components/listing-profile/FinanceOwnerTab';

function ListingProfileContent() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const listingId = params.id as string;
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState<Partial<Listing>>({});
  const [operationsSnapshot, setOperationsSnapshot] = useState<Partial<ListingOperations> | null>(null);
  const [binCollection, setBinCollection] = useState<BinCollectionItem[]>([]);

  useEffect(() => {
    loadListing();
  }, [listingId]);

  const loadListing = async () => {
    setIsLoading(true);
    try {
      const [listingRes, opsRes] = await Promise.all([
        fetch(`/api/listings/${listingId}`),
        fetch(`/api/listings/${listingId}/operations`),
      ]);
      const listingData = await listingRes.json();
      const opsData = await opsRes.json();

      if (listingData.success && listingData.listing) {
        const listingRow = listingData.listing as Listing;
        setListing(listingRow);
        setFormData(listingRow);

        let items: BinCollectionItem[] = [];
        if (opsData.success && opsData.operations) {
          setOperationsSnapshot(opsData.operations);
          items = normalizeBinCollectionArray(opsData.operations.bin_collection);
        } else {
          setOperationsSnapshot(null);
        }
        if (items.length === 0 && listingRow.bin_collection_day) {
          const legacy = legacyDayToBinItem(listingRow.bin_collection_day);
          if (legacy) items = [legacy];
        }
        setBinCollection(items);
      } else {
        toast.error('Failed to load listing');
      }
    } catch (error) {
      console.error('Error loading listing:', error);
      toast.error('Failed to load listing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const opsBody: Partial<ListingOperations> = {
        ...(operationsSnapshot || {}),
        bin_collection: binCollection,
      };

      const opsRes = await fetch(`/api/listings/${listingId}/operations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opsBody),
      });
      const opsJson = await opsRes.json();

      if (!opsJson.success) {
        toast.error(opsJson.error || 'Failed to save operations (bin collection)');
        return;
      }

      setOperationsSnapshot(opsJson.operations);

      const listingPayload = {
        ...formData,
        bin_collection_day: null,
      };

      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingPayload),
      });

      const data = await response.json();

      if (!data.success) {
        toast.error(data.error || 'Failed to save listing details');
        return;
      }

      toast.success('Changes saved successfully');
      setHasChanges(false);
      await loadListing();
    } catch (error) {
      console.error('Error saving listing:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const updateFormData = (updates: Partial<Listing>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateBinCollection = (items: BinCollectionItem[]) => {
    setBinCollection(items);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading listing profile...</span>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <p className="text-lg text-gray-600 mb-4">Listing not found</p>
        <Button onClick={() => router.push('/dashboard/listings')}>
          Back to Listings
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Listing Profile - {listing.name}</h1>
          <p className="text-gray-500 mt-1">Full details and data for this property</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard/listings')}
            className="flex-1 md:flex-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Listings
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex-1 md:flex-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="operations" >
            Operations
          </TabsTrigger>
          <TabsTrigger value="documents">Docs & Compliance</TabsTrigger>
          <TabsTrigger value="checklist">L&P/Cleaner List</TabsTrigger>
          <TabsTrigger value="landlord-reports">Finance/Owner</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            listing={listing}
            formData={formData}
            updateFormData={updateFormData}
            binCollection={binCollection}
            onBinCollectionChange={updateBinCollection}
            isAdmin={user?.role === 'admin'}
            canEditCalendarFeeds={user?.role === 'admin' || user?.role === 'sub-admin'}
          />
        </TabsContent>

        <TabsContent value="operations">
         <OperationsTab listingId={listingId} />
        </TabsContent>

        <TabsContent value="documents">
          <DocsComplianceTab listingId={listingId} listingName={listing.name} />
        </TabsContent>

        <TabsContent value="checklist">
          <LPCleanerListTab 
            listingId={listingId} 
            listingName={listing.name}
            formData={formData}
            updateFormData={updateFormData}
          />
        </TabsContent>

        <TabsContent value="landlord-reports">
          <FinanceOwnerTab 
            listingId={listingId} 
            listing={listing}
            formData={formData}
            updateFormData={updateFormData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ListingProfilePage() {
  return (
    <ProtectedRoute allowedRoles={['admin', 'sub-admin']}>
      <ListingProfileContent />
    </ProtectedRoute>
  );
}

