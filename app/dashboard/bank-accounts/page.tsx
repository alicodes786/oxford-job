'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Listing } from '@/lib/models';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Pencil, Save, X } from 'lucide-react';

interface BankAccountAssociation {
  bank_account: string;
  listings: Listing[];
}

function BankAccountManagementContent() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [associations, setAssociations] = useState<BankAccountAssociation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBankAccount, setNewBankAccount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load listings and group by bank account
  const loadData = async () => {
    try {
      const response = await fetch('/api/listings');
      const data = await response.json();
      
      if (data.success) {
        setListings(data.listings);
        
        // Group listings by bank account
        const grouped = data.listings.reduce((acc: Record<string, Listing[]>, listing: Listing) => {
          const bankAccount = listing.bank_account || 'Not Assigned';
          if (!acc[bankAccount]) acc[bankAccount] = [];
          acc[bankAccount].push(listing);
          return acc;
        }, {});
        
        const associationsList: BankAccountAssociation[] = Object.entries(grouped).map(([bank_account, listings]) => ({
          bank_account,
          listings: listings as Listing[]
        }));
        
        setAssociations(associationsList);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  };

  // Update a listing's bank account
  const updateBankAccount = async (listingId: string, bankAccount: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bank_account: bankAccount }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Bank account updated successfully');
        loadData(); // Reload data to refresh the associations
        setEditingId(null);
        setNewBankAccount('');
      } else {
        toast.error(data.error || 'Failed to update bank account');
      }
    } catch (error) {
      console.error('Error updating bank account:', error);
      toast.error('Failed to update bank account');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get all unique bank accounts
  const getAllBankAccounts = () => {
    const bankAccounts = new Set(listings.map(l => l.bank_account).filter((ba): ba is string => ba !== null));
    return Array.from(bankAccounts);
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Bank Account Management</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage bank account associations for properties to enable payment breakdown in reports.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">💡 How This Works</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Step 1:</strong> Associate each property with its bank account below</li>
              <li>• <strong>Step 2:</strong> Generate NEW payment reports to see bank account breakdown</li>
              <li>• <strong>Step 3:</strong> Payment reports will show how much to pay from each bank account</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              ⚠️ <strong>Important:</strong> Existing payment reports won't show bank account breakdown. You need to generate new reports after setting up these associations.
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{listings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Bank Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{getAllBankAccounts().length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Unassigned Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {listings.filter(l => !l.bank_account).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bank Account Associations */}
        <div className="space-y-6">
          {associations.map((association) => (
            <Card key={association.bank_account}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {association.bank_account === 'Not Assigned' ? (
                    <span className="text-orange-600">⚠️ Not Assigned</span>
                  ) : (
                    <span className="text-green-600">🏦 {association.bank_account}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    {association.listings.length} properties associated
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {association.listings.map((listing) => (
                      <div key={listing.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: listing.color || '#gray' }}></div>
                          <div>
                            <div className="font-medium text-sm">{listing.name}</div>
                            <div className="text-xs text-gray-500">{listing.hours}h</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {editingId === listing.id ? (
                            <div className="flex items-center space-x-2">
                              <Select value={newBankAccount} onValueChange={setNewBankAccount}>
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CU">CU</SelectItem>
                                  <SelectItem value="JCB Unit 1">JCB Unit 1</SelectItem>
                                  <SelectItem value="JCB Unit 2">JCB Unit 2</SelectItem>
                                  <SelectItem value="SWJC">SWJC</SelectItem>
                                  <SelectItem value="185 CR">185 CR</SelectItem>
                                  <SelectItem value="234 CR">234 CR</SelectItem>
                                  <SelectItem value="Sofia 378">Sofia 378</SelectItem>
                                  {getAllBankAccounts()
                                    .filter(ba => !['CU', 'JCB Unit 1', 'JCB Unit 2', 'SWJC', '185 CR', '234 CR', 'Sofia 378'].includes(ba))
                                    .map(ba => (
                                      <SelectItem key={ba} value={ba}>{ba}</SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => updateBankAccount(listing.id, newBankAccount)}
                                disabled={isUpdating || !newBankAccount}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingId(null);
                                  setNewBankAccount('');
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(listing.id);
                                setNewBankAccount(listing.bank_account || '');
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BankAccountManagementPage() {
  return (
    <ProtectedRoute>
      <BankAccountManagementContent />
    </ProtectedRoute>
  );
} 