'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CleanerExtraReport } from '@/lib/cleaner-extra-reports';

interface CleanerExtraInfoFormProps {
  cleanerUuid: string;
  weekStartDate: string;
  weekDisplayName: string;
  onSubmitSuccess?: (report: CleanerExtraReport) => void;
  className?: string;
}

export default function CleanerExtraInfoForm({
  cleanerUuid,
  weekStartDate,
  weekDisplayName,
  onSubmitSuccess,
  className = ''
}: CleanerExtraInfoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [extraHours, setExtraHours] = useState('');
  const [notes, setNotes] = useState('');
  const [listings, setListings] = useState<any[]>([]);
  const [existingReports, setExistingReports] = useState<CleanerExtraReport[]>([]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  // Load listings and existing reports
  const loadData = async () => {
    try {
      // Load listings
      const listingsResponse = await fetch('/api/listings');
      const listingsData = await listingsResponse.json();
      if (listingsData.success) {
        setListings(listingsData.listings);
      }

      // Load existing reports
      const reportsResponse = await fetch(`/api/cleaner-extra-reports?cleaner_uuid=${cleanerUuid}&week_start_date=${weekStartDate}`);
      const reportsData = await reportsResponse.json();
      if (reportsData.success) {
        setExistingReports(reportsData.reports);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [cleanerUuid, weekStartDate]);

  const handleEdit = (report: CleanerExtraReport) => {
    setEditingReportId(report.id);
    setSelectedListingId(report.listing_id || '');
    setExtraHours(report.extra_hours.toString());
    setNotes(report.notes || '');
  };

  const handleCancel = () => {
    setEditingReportId(null);
    setSelectedListingId('');
    setExtraHours('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const extraHoursNum = parseFloat(extraHours);
    if (isNaN(extraHoursNum) || extraHoursNum <= 0) {
      toast.error('Please enter valid extra hours');
      return;
    }

    if (extraHoursNum > 0 && !selectedListingId) {
      toast.error('Please select a property');
      return;
    }

    setIsSubmitting(true);
    let submittedReport: CleanerExtraReport | null = null;

    try {
      // If editing, update the existing report
      if (editingReportId) {
        const response = await fetch(`/api/cleaner-extra-reports/${editingReportId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            extra_hours: extraHoursNum,
            listing_id: selectedListingId,
            notes: notes.trim()
          }),
        });

        const data = await response.json();
        if (data.success) {
          submittedReport = data.report;
          toast.success('Extra info updated successfully!');
          handleCancel(); // Reset form
        } else {
          toast.error(data.error || 'Failed to update extra info');
        }
      } else {
        // Create new report
        const response = await fetch('/api/cleaner-extra-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cleaner_uuid: cleanerUuid,
            week_start_date: weekStartDate,
            travel_minutes: 0,
            extra_hours: extraHoursNum,
            listing_id: selectedListingId,
            notes: notes.trim()
          }),
        });

        const data = await response.json();
        if (data.success) {
          submittedReport = data.report;
          toast.success('Extra info submitted successfully!');
          handleCancel(); // Reset form
        } else {
          toast.error(data.error || 'Failed to submit extra info');
        }
      }

      // Reload data to show updated reports
      await loadData();

      // Auto-update the payment report
      try {
        await fetch('/api/payment-reports/update-extra-hours', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cleaner_uuid: cleanerUuid,
            week_start_date: weekStartDate
          }),
        });
      } catch (error) {
        console.warn('Error auto-updating payment report:', error);
      }

      if (onSubmitSuccess && submittedReport) {
        onSubmitSuccess(submittedReport);
      }
    } catch (error) {
      console.error('Error submitting extra info:', error);
      toast.error('An unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <h2 className="text-lg font-semibold mb-4">Extra Hours for {weekDisplayName}</h2>

      {/* Show existing reports */}
      {existingReports.length > 0 && (
        <div className="mb-6 space-y-4">
          <h3 className="text-md font-medium">Submitted Reports</h3>
          {existingReports.map((report) => (
            <div key={report.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{report.extra_hours} hours</p>
                  {report.listing_id && (
                    <p className="text-sm text-gray-600">
                      Property: {listings.find(l => l.id === report.listing_id)?.name || report.listing_id}
                    </p>
                  )}
                  {report.notes && (
                    <p className="text-sm text-gray-600 mt-1">Notes: {report.notes}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted: {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEdit(report)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form for new/edit submission */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Property
          </label>
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select a property</option>
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Extra Hours
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={extraHours}
            onChange={(e) => setExtraHours(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter extra hours"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
            placeholder="Add any notes about the extra hours"
          />
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : editingReportId ? 'Update Report' : 'Submit Report'}
          </button>
          {editingReportId && (
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
} 