'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { BarChart3, Plus, Edit, Trash2, Download, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Listing, ListingRentEntry } from '@/lib/models';
import { format } from 'date-fns';

interface LandlordReportsTabProps {
  listingId: string;
  listing: Listing;
}

export function LandlordReportsTab({ listingId, listing }: LandlordReportsTabProps) {
  const [reportData, setReportData] = useState<any>(null);
  const [rentEntries, setRentEntries] = useState<ListingRentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ListingRentEntry | null>(null);
  
  // Period selection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  
  const [formData, setFormData] = useState({
    gross_rent: '',
    expenses_out: '',
    notes: ''
  });

  useEffect(() => {
    loadReport();
    loadRentEntries();
  }, [listingId, selectedMonth, selectedYear]);

  const loadReport = async () => {
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
      console.error('Error loading report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRentEntries = async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}/rent-entries`);
      const data = await response.json();
      
      if (data.success) {
        setRentEntries(data.rent_entries);
      }
    } catch (error) {
      console.error('Error loading rent entries:', error);
    }
  };

  const handleSaveRentEntry = async () => {
    if (!formData.gross_rent && !formData.expenses_out) {
      toast.error('Please enter at least one value');
      return;
    }

    try {
      const url = editingEntry
        ? `/api/listings/${listingId}/rent-entries/${editingEntry.id}`
        : `/api/listings/${listingId}/rent-entries`;
      
      const method = editingEntry ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_month: selectedMonth,
          period_year: selectedYear,
          gross_rent: formData.gross_rent ? parseFloat(formData.gross_rent) : null,
          expenses_out: formData.expenses_out ? parseFloat(formData.expenses_out) : null,
          notes: formData.notes || null
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(editingEntry ? 'Rent entry updated' : 'Rent entry added');
        setDialogOpen(false);
        resetForm();
        loadRentEntries();
        loadReport();
      } else {
        toast.error(data.error || 'Failed to save rent entry');
      }
    } catch (error) {
      console.error('Error saving rent entry:', error);
      toast.error('Failed to save rent entry');
    }
  };

  const handleEdit = (entry: ListingRentEntry) => {
    setEditingEntry(entry);
    setFormData({
      gross_rent: entry.gross_rent?.toString() || '',
      expenses_out: entry.expenses_out?.toString() || '',
      notes: entry.notes || ''
    });
    setSelectedMonth(entry.period_month);
    setSelectedYear(entry.period_year);
    setDialogOpen(true);
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this rent entry?')) return;

    try {
      const response = await fetch(`/api/listings/${listingId}/rent-entries/${entryId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Rent entry deleted');
        loadRentEntries();
        loadReport();
      }
    } catch (error) {
      console.error('Error deleting rent entry:', error);
      toast.error('Failed to delete rent entry');
    }
  };

  const resetForm = () => {
    setEditingEntry(null);
    setFormData({
      gross_rent: '',
      expenses_out: '',
      notes: ''
    });
  };

  const handleExport = () => {
    toast.info('PDF export feature coming soon!');
    // TODO: Implement PDF generation
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYearRange = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  // Get rent entry for current period
  const currentPeriodEntry = rentEntries.find(
    e => e.period_month === selectedMonth && e.period_year === selectedYear
  );

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Landlord Report for {listing.name}</h2>
          <p className="text-sm text-gray-500">
            {listing.landlord_name && `Landlord: ${listing.landlord_name}`}
            {listing.landlord_email && ` • ${listing.landlord_email}`}
          </p>
        </div>
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
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading report data...</span>
        </div>
      ) : (
        <>
          {/* Cleaning Data Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Cleaning Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData?.cleaning_summary?.total_cleanings > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Cleanings</p>
                      <p className="text-2xl font-bold">{reportData.cleaning_summary.total_cleanings}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Hours</p>
                      <p className="text-2xl font-bold">{reportData.cleaning_summary.total_hours.toFixed(1)}h</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Cost</p>
                      <p className="text-2xl font-bold">£{reportData.cleaning_summary.total_cost.toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Breakdown by Date</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium">Date</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Cleaner</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Hours</th>
                            <th className="px-4 py-2 text-left text-sm font-medium">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.cleaning_summary.cleanings.map((cleaning: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-4 py-2 text-sm">
                                {cleaning.date 
                                  ? format(new Date(cleaning.date), 'MMM dd, yyyy')
                                  : 'N/A'
                                }
                              </td>
                              <td className="px-4 py-2 text-sm">{cleaning.cleaner_name}</td>
                              <td className="px-4 py-2 text-sm">{cleaning.hours.toFixed(1)}h</td>
                              <td className="px-4 py-2 text-sm">£{cleaning.cost.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 py-4">No cleaning data for this period.</p>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Logs Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Maintenance Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportData?.maintenance_logs?.length > 0 ? (
                <div className="space-y-3">
                  {reportData.maintenance_logs.map((log: any, idx: number) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm text-gray-600">
                            {log.date 
                              ? format(new Date(log.date), 'MMM dd, yyyy')
                              : 'N/A'
                            } • Reported by: {log.cleaner_name}
                          </p>
                          <p className="mt-2">{log.issue}</p>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/dashboard/cleaner-reports?report=${log.report_id}`} target="_blank">
                            View Full Report
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 py-4">No maintenance issues reported for this period.</p>
              )}
            </CardContent>
          </Card>

          {/* Rent Figures Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Rent Figures</CardTitle>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingEntry ? 'Edit Rent Entry' : 'Add Rent Entry'}
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label>Period: {months[selectedMonth - 1]} {selectedYear}</Label>
                      </div>
                      
                      <div>
                        <Label htmlFor="gross_rent">Gross Rent (£)</Label>
                        <Input
                          id="gross_rent"
                          type="number"
                          step="0.01"
                          value={formData.gross_rent}
                          onChange={(e) => setFormData({ ...formData, gross_rent: e.target.value })}
                          placeholder="3500.00"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="expenses_out">Expenses Out (£)</Label>
                        <Input
                          id="expenses_out"
                          type="number"
                          step="0.01"
                          value={formData.expenses_out}
                          onChange={(e) => setFormData({ ...formData, expenses_out: e.target.value })}
                          placeholder="890.00"
                        />
                      </div>
                      
                      {formData.gross_rent && formData.expenses_out && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-sm text-gray-600">Net Rent Payout</p>
                          <p className="text-xl font-bold">
                            £{(parseFloat(formData.gross_rent) - parseFloat(formData.expenses_out)).toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      <div>
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Additional information..."
                          className="min-h-20"
                        />
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveRentEntry}>
                        {editingEntry ? 'Update' : 'Add'} Entry
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {currentPeriodEntry ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <h4 className="font-semibold">
                          {months[currentPeriodEntry.period_month - 1]} {currentPeriodEntry.period_year}
                        </h4>
                        <div className="grid grid-cols-3 gap-4 mt-2">
                          <div>
                            <p className="text-sm text-gray-600">Gross Rent</p>
                            <p className="font-semibold">
                              £{currentPeriodEntry.gross_rent?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Expenses Out</p>
                            <p className="font-semibold">
                              £{currentPeriodEntry.expenses_out?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Net Rent Payout</p>
                            <p className="font-semibold text-green-600">
                              £{currentPeriodEntry.net_rent_payout?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                        {currentPeriodEntry.notes && (
                          <p className="text-sm text-gray-600 mt-2">{currentPeriodEntry.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(currentPeriodEntry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(currentPeriodEntry.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 py-4">
                  No rent entry for {months[selectedMonth - 1]} {selectedYear}. Click "Add Entry" to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

