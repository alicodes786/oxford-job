'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  User, 
  FileText, 
  DollarSign, 
  StickyNote, 
  BarChart3, 
  Upload,
  Download,
  X,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { Listing } from '@/lib/models';
import { format } from 'date-fns';

interface FinanceOwnerTabProps {
  listingId: string;
  listing: Listing;
  formData: Partial<Listing>;
  updateFormData: (updates: Partial<Listing>) => void;
}

export function FinanceOwnerTab({ listingId, listing, formData, updateFormData }: FinanceOwnerTabProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [managementContract, setManagementContract] = useState<any>(null);
  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [showCleaningDetails, setShowCleaningDetails] = useState(false);
  
  // Period selection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  useEffect(() => {
    loadManagementContract();
  }, [listingId]);

  useEffect(() => {
    loadFinancialReport();
  }, [listingId, selectedMonth, selectedYear]);

  const loadManagementContract = async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}/documents`);
      const data = await response.json();
      
      if (data.success) {
        const contract = data.documents.find((doc: any) => doc.file_type === 'management_contract');
        setManagementContract(contract || null);
      }
    } catch (error) {
      console.error('Error loading management contract:', error);
    }
  };

  const loadFinancialReport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/listings/${listingId}/landlord-report?period_month=${selectedMonth}&period_year=${selectedYear}`
      );
      const data = await response.json();
      
      if (data.success) {
        setReportData(data.report);
      }
    } catch (error) {
      console.error('Error loading financial report:', error);
      toast.error('Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContractUpload = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'management_contract');
    formData.append('description', 'Signed Management Contract');

    setIsUploadingContract(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/documents`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Management contract uploaded successfully');
        loadManagementContract();
      } else {
        toast.error(data.error || 'Failed to upload contract');
      }
    } catch (error) {
      console.error('Error uploading contract:', error);
      toast.error('Failed to upload contract');
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!managementContract || !confirm('Are you sure you want to delete this contract?')) return;

    try {
      const response = await fetch(`/api/listings/${listingId}/documents/${managementContract.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Contract deleted');
        setManagementContract(null);
      } else {
        toast.error('Failed to delete contract');
      }
    } catch (error) {
      console.error('Error deleting contract:', error);
      toast.error('Failed to delete contract');
    }
  };

  const formatPrice = (value: number | null | undefined) => {
    if (!value) return '£0.00';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYearRange = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // Calculate total expenses (Oxford: L&P / laundry excluded from listings scope)
  const cleanerExpenses = reportData?.cleaning_summary?.total_cost || 0;
  const totalExpenses = cleanerExpenses;

  return (
    <div className="space-y-6">
      {/* Widget 1: Owner/Landlord Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Owner/Landlord Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="landlord_email">Email</Label>
              <Input
                id="landlord_email"
                type="email"
                value={formData.landlord_email || ''}
                onChange={(e) => updateFormData({ landlord_email: e.target.value })}
                placeholder="owner@example.com"
              />
            </div>
            
            <div>
              <Label htmlFor="landlord_phone">Primary Phone</Label>
              <Input
                id="landlord_phone"
                type="tel"
                value={formData.landlord_phone || ''}
                onChange={(e) => updateFormData({ landlord_phone: e.target.value })}
                placeholder="+44 7700 900000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="landlord_alternative_phone">Alternative Phone</Label>
              <Input
                id="landlord_alternative_phone"
                type="tel"
                value={formData.landlord_alternative_phone || ''}
                onChange={(e) => updateFormData({ landlord_alternative_phone: e.target.value })}
                placeholder="+44 20 7946 0958"
              />
            </div>

            <div>
              <Label htmlFor="landlord_payment_preference">Payment Preference</Label>
              <Select
                value={formData.landlord_payment_preference || ''}
                onValueChange={(value) => updateFormData({ landlord_payment_preference: value })}
              >
                <SelectTrigger id="landlord_payment_preference">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="revolut">Revolut</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="wise">Wise</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="landlord_city">City</Label>
              <Input
                id="landlord_city"
                value={formData.landlord_city || ''}
                onChange={(e) => updateFormData({ landlord_city: e.target.value })}
                placeholder="London"
              />
            </div>
            
            <div>
              <Label htmlFor="landlord_postcode">Postcode</Label>
              <Input
                id="landlord_postcode"
                value={formData.landlord_postcode || ''}
                onChange={(e) => updateFormData({ landlord_postcode: e.target.value })}
                placeholder="SW1A 1AA"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="owner_stays_restrictions">Owner Stays / Restrictions</Label>
            <Textarea
              id="owner_stays_restrictions"
              value={formData.owner_stays_restrictions || ''}
              onChange={(e) => updateFormData({ owner_stays_restrictions: e.target.value })}
              placeholder="e.g., No pets, Use only CB linens, No smoking, Owner stays in July"
              className="min-h-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Widget 2: Financial Summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Financial Summary
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, idx) => (
                    <SelectItem key={idx} value={(idx + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentYearRange.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading financial data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Cleanings</p>
                  <p className="text-2xl font-bold">{reportData?.cleaning_summary?.total_cleanings || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold">{reportData?.cleaning_summary?.total_hours?.toFixed(1) || '0.0'}h</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Cleaner Expenses</p>
                  <p className="text-2xl font-bold">{formatPrice(cleanerExpenses)}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Expenses</p>
                  <p className="text-3xl font-bold">{formatPrice(totalExpenses)}</p>
                </div>
              </div>

              {/* Detailed Cleaning Breakdown */}
              {reportData?.cleaning_summary?.total_cleanings > 0 && (
                <div>
                  <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => setShowCleaningDetails(!showCleaningDetails)}
                  >
                    <span className="font-semibold">Detailed Cleaning Breakdown</span>
                    {showCleaningDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  
                  {showCleaningDetails && (
                    <div className="border rounded-lg overflow-hidden mt-2">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Cleaner</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Hours</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Rate</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.cleaning_summary.cleanings.map((cleaning: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2 text-sm">
                                {cleaning.date ? format(new Date(cleaning.date), 'dd MMM yyyy') : 'N/A'}
                              </td>
                              <td className="px-4 py-2 text-sm">{cleaning.cleaner_name}</td>
                              <td className="px-4 py-2 text-sm">{cleaning.hours.toFixed(1)}h</td>
                              <td className="px-4 py-2 text-sm">{formatPrice(cleaning.hourly_rate)}/h</td>
                              <td className="px-4 py-2 text-sm font-semibold">{formatPrice(cleaning.cost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {!reportData?.cleaning_summary?.total_cleanings && (
                <div className="text-center py-8 text-gray-500">
                  <p>No financial data available for {months[selectedMonth - 1]} {selectedYear}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Widget 3: Management Contract */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Signed Management Contract
          </CardTitle>
        </CardHeader>
        <CardContent>
          {managementContract ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-blue-600 mt-1" />
                  <div>
                    <p className="font-medium">{managementContract.file_name}</p>
                    <p className="text-sm text-gray-500">
                      Uploaded: {format(new Date(managementContract.uploaded_at), 'dd MMM yyyy')}
                    </p>
                    {managementContract.file_size && (
                      <p className="text-xs text-gray-400">
                        {(managementContract.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(managementContract.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteContract}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Upload Signed Management Contract</p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                <label className="mt-4 inline-block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleContractUpload(file);
                    }}
                    disabled={isUploadingContract}
                  />
                  <Button
                    variant="outline"
                    disabled={isUploadingContract}
                    onClick={(e) => {
                      e.preventDefault();
                      (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
                    }}
                  >
                    {isUploadingContract ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </Button>
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Widget 4: Rates & Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Rates & Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nightly_rate_low">Nightly Rate - Low Season (£)</Label>
              <Input
                id="nightly_rate_low"
                type="number"
                step="0.01"
                value={formData.nightly_rate_low || ''}
                onChange={(e) => updateFormData({ nightly_rate_low: parseFloat(e.target.value) || null })}
                placeholder="80.00"
              />
            </div>
            
            <div>
              <Label htmlFor="nightly_rate_mid">Nightly Rate - Mid Season (£)</Label>
              <Input
                id="nightly_rate_mid"
                type="number"
                step="0.01"
                value={formData.nightly_rate_mid || ''}
                onChange={(e) => updateFormData({ nightly_rate_mid: parseFloat(e.target.value) || null })}
                placeholder="120.00"
              />
            </div>
            
            <div>
              <Label htmlFor="nightly_rate_high">Nightly Rate - High Season (£)</Label>
              <Input
                id="nightly_rate_high"
                type="number"
                step="0.01"
                value={formData.nightly_rate_high || ''}
                onChange={(e) => updateFormData({ nightly_rate_high: parseFloat(e.target.value) || null })}
                placeholder="180.00"
              />
            </div>
            
            <div>
              <Label htmlFor="cleaning_fee">Cleaning Fee (£)</Label>
              <Input
                id="cleaning_fee"
                type="number"
                step="0.01"
                value={formData.cleaning_fee || ''}
                onChange={(e) => updateFormData({ cleaning_fee: parseFloat(e.target.value) || null })}
                placeholder="50.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Widget 5: Report Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <StickyNote className="h-5 w-5 mr-2" />
            Notes for Next Landlord Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="landlord_report_notes"
            value={formData.landlord_report_notes || ''}
            onChange={(e) => updateFormData({ landlord_report_notes: e.target.value })}
            placeholder="Add any notes or items to include in the next report..."
            className="min-h-32"
          />
        </CardContent>
      </Card>

      {/* RENT ENTRY WIDGET - Commented out for now */}
      {/* 
      <Card>
        <CardHeader>
          <CardTitle>Rent Figures</CardTitle>
        </CardHeader>
        <CardContent>
          ... rent entry form and data ...
        </CardContent>
      </Card>
      */}
    </div>
  );
}

