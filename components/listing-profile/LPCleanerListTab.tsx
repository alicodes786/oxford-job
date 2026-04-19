'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, FileText } from 'lucide-react';
import { Listing } from '@/lib/models';
import { Badge } from '@/components/ui/badge';
import { CompletionFormBuilder } from '@/components/listing-profile/CompletionFormBuilder';

interface ListingPaymentData {
  recordId: string;
  period_name: string;
  date_mode: 'month' | 'custom';
  month?: string;
  year?: string;
  start_date?: string;
  end_date?: string;
  checkout_count: number;
  laundry_total: number;
  peripheral_total: number;
  grand_total: number;
  created_at?: string;
}

interface LPCleanerListTabProps {
  listingId: string;
  listingName: string;
  formData: Partial<Listing>;
  updateFormData: (updates: Partial<Listing>) => void;
}

export function LPCleanerListTab({ listingId, listingName, formData, updateFormData }: LPCleanerListTabProps) {
  const [paymentRecords, setPaymentRecords] = useState<ListingPaymentData[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(true);

  useEffect(() => {
    loadPaymentRecords();
  }, [listingId, listingName]);

  const loadPaymentRecords = async () => {
    setIsLoadingPayments(true);
    try {
      const response = await fetch('/api/laundry-calculator/payment-records');
      const data = await response.json();

      if (data.success && data.data) {
        const listingRecords: ListingPaymentData[] = [];

        data.data.forEach((record: any) => {
          if (record.payment_data && record.payment_data[listingName]) {
            const listingData = record.payment_data[listingName];
            listingRecords.push({
              recordId: record.id,
              period_name: record.period_name,
              date_mode: record.date_mode,
              month: record.month,
              year: record.year,
              start_date: record.start_date,
              end_date: record.end_date,
              checkout_count: listingData.checkout_count,
              laundry_total: listingData.laundry_total,
              peripheral_total: listingData.peripheral_total,
              grand_total: listingData.grand_total,
              created_at: record.created_at,
            });
          }
        });

        const sortedAndLimited = listingRecords
          .sort((a, b) => {
            const dateA = new Date(a.created_at || 0).getTime();
            const dateB = new Date(b.created_at || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 10);

        setPaymentRecords(sortedAndLimited);
      }
    } catch (error) {
      console.error('Error loading payment records:', error);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
              Laundry & Peripheral Payment Records
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              From L&P Calculator
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Payment records for {listingName} from the Laundry & Peripherals Calculator
          </p>
        </CardHeader>
        <CardContent>
          {isLoadingPayments ? (
            <div className="text-center py-4 text-gray-500">Loading payment records...</div>
          ) : paymentRecords.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <p>No payment records found for this listing.</p>
              <p className="text-xs mt-2">Generate payment records in the L&P Calculator to see them here.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-gray-500 text-right">
                Showing {paymentRecords.length} most recent record{paymentRecords.length !== 1 ? 's' : ''}
              </div>
              <div className="space-y-3">
                {paymentRecords.map((record) => (
                  <div key={record.recordId} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{record.period_name}</h4>
                        <p className="text-sm text-gray-500">
                          {record.date_mode === 'month'
                            ? `${record.month} ${record.year}`
                            : `${record.start_date} - ${record.end_date}`}
                        </p>
                      </div>
                      <Badge variant="outline">{record.checkout_count} checkouts</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Laundry</p>
                        <p className="font-semibold text-blue-600">{formatPrice(record.laundry_total)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Peripherals</p>
                        <p className="font-semibold text-green-600">{formatPrice(record.peripheral_total)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Total</p>
                        <p className="font-bold text-lg">{formatPrice(record.grand_total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Other Important Notes
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Additional notes for cleaners about this specific property</p>
        </CardHeader>
        <CardContent>
          <Textarea
            id="cleaner_important_notes"
            value={formData.cleaner_important_notes || ''}
            onChange={(e) => updateFormData({ cleaner_important_notes: e.target.value })}
            placeholder="Add any important notes for cleaners here... (e.g., special instructions, quirks, things to watch out for)"
            className="min-h-32"
          />
        </CardContent>
      </Card>

      <CompletionFormBuilder listingId={listingId} listingName={listingName} />
    </div>
  );
}
