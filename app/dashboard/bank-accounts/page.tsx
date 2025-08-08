'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Listing } from '@/lib/models';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Pencil, Save, X, Plus, Trash2 } from 'lucide-react';
import { Settings } from '@/lib/settings';

interface BankAccountAssociation {
  bank_account: string;
  listings: Listing[];
}

function BankAccountManagementContent() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [associations, setAssociations] = useState<BankAccountAssociation[]>([]);
  const [availableBankAccounts, setAvailableBankAccounts] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newBankAccountName, setNewBankAccountName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bankAccountToDelete, setBankAccountToDelete] = useState<string | null>(null);

  // Load settings to get available bank accounts
  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const settings: Settings = await response.json();
      setAvailableBankAccounts(settings.bankAccounts || []);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load bank accounts');
    }
  };

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

  // Add a new bank account
  const addBankAccount = async () => {
    if (!newBankAccountName.trim()) {
      toast.error('Please enter a bank account name');
      return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'add_bank_account',
          bankAccount: newBankAccountName.trim(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Bank account added successfully');
        setNewBankAccountName('');
        loadSettings(); // Reload settings to refresh available bank accounts
      } else {
        toast.error(data.error || 'Failed to add bank account');
      }
    } catch (error) {
      console.error('Error adding bank account:', error);
      toast.error('Failed to add bank account');
    }
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (bankAccountName: string) => {
    // Check if any listings are using this bank account
    const listingsUsingAccount = listings.filter(l => l.bank_account === bankAccountName);
    if (listingsUsingAccount.length > 0) {
      toast.error(`Cannot remove "${bankAccountName}" - it's assigned to ${listingsUsingAccount.length} properties`);
      return;
    }

    setBankAccountToDelete(bankAccountName);
    setDeleteDialogOpen(true);
  };

  // Actually remove the bank account
  const confirmRemoveBankAccount = async () => {
    if (!bankAccountToDelete) return;

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'remove_bank_account',
          bankAccount: bankAccountToDelete,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`"${bankAccountToDelete}" removed successfully`);
        loadSettings(); // Reload settings to refresh available bank accounts
      } else {
        toast.error(data.error || 'Failed to remove bank account');
      }
    } catch (error) {
      console.error('Error removing bank account:', error);
      toast.error('Failed to remove bank account');
    } finally {
      setDeleteDialogOpen(false);
      setBankAccountToDelete(null);
    }
  };

  useEffect(() => {
    loadSettings();
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
            Manage bank accounts and their associations with properties to enable payment breakdown in reports.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">💡 How This Works</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Step 1:</strong> Add bank accounts using the form below</li>
              <li>• <strong>Step 2:</strong> Associate each property with its bank account</li>
              <li>• <strong>Step 3:</strong> Generate NEW payment reports to see bank account breakdown</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              ⚠️ <strong>Important:</strong> Existing payment reports won't show bank account breakdown. You need to generate new reports after setting up these associations.
            </p>
          </div>
        </div>

        {/* Add New Bank Account */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Bank Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Label htmlFor="new-bank-account">Bank Account Name</Label>
                <Input
                  id="new-bank-account"
                  value={newBankAccountName}
                  onChange={(e) => setNewBankAccountName(e.target.value)}
                  placeholder="Enter bank account name (e.g., JCB Unit 3)"
                  onKeyPress={(e) => e.key === 'Enter' && addBankAccount()}
                />
              </div>
              <Button onClick={addBankAccount} className="mt-6">
                <Plus className="w-4 h-4 mr-2" />
                Add Bank Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Available Bank Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableBankAccounts.map((bankAccount) => (
                <div key={bankAccount} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{bankAccount}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openDeleteDialog(bankAccount)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            {availableBankAccounts.length === 0 && (
              <p className="text-gray-500 text-center py-4">No bank accounts available. Add one above.</p>
            )}
          </CardContent>
        </Card>

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
              <div className="text-2xl font-bold text-gray-900">{availableBankAccounts.length}</div>
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
                                  {availableBankAccounts.map(ba => (
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Bank Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{bankAccountToDelete}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmRemoveBankAccount}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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