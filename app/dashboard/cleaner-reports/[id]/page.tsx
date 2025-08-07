'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Star, AlertTriangle, CheckCircle, XCircle, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { JobCompletionReport, formatDuration, getChecklistCompletionPercentage } from '@/lib/cleaner-reports';

interface ReportDetailPageProps {}

export default function ReportDetailPage({}: ReportDetailPageProps) {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<JobCompletionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reportId = params.id as string;

  // Helper function to safely parse completion dates
  const parseCompletionDate = (completionDate: string): Date | null => {
    try {
      if (!completionDate) return null;
      
      let reportDate;
      if (completionDate.includes('T')) {
        reportDate = new Date(completionDate);
      } else {
        reportDate = new Date(completionDate + 'T00:00:00');
      }
      
      // Validate date
      if (isNaN(reportDate.getTime())) {
        console.warn('Invalid completion_date:', completionDate);
        return null;
      }
      
      return reportDate;
    } catch (error) {
      console.warn('Error parsing completion_date:', completionDate, error);
      return null;
    }
  };

  useEffect(() => {
    const loadReport = async () => {
      if (!reportId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/cleaner-reports/${reportId}`);
        const data = await response.json();
        
        if (data.success) {
          setReport(data.report);
        } else {
          toast.error('Failed to load report');
          router.push('/dashboard/cleaner-reports');
        }
      } catch (error) {
        console.error('Error loading report:', error);
        toast.error('Failed to load report');
        router.push('/dashboard/cleaner-reports');
      } finally {
        setIsLoading(false);
      }
    };

    loadReport();
  }, [reportId, router]);

  // Export report as text
  const exportReport = () => {
    if (!report) return;

    const reportText = `
CLEANING JOB COMPLETION REPORT
==============================

Job Information:
- Report ID: ${report.id}
- Date: ${(() => {
      const reportDate = parseCompletionDate(report.completion_date);
      return reportDate ? format(reportDate, 'MMMM d, yyyy') : report.completion_date;
    })()}
- Listing: ${report.listing_name}
- Cleaner: ${report.cleaner?.name || 'Unknown'}

Timing:
- Start Time: ${report.start_time ? format(new Date(report.start_time), 'h:mm a') : 'N/A'}
- End Time: ${report.end_time ? format(new Date(report.end_time), 'h:mm a') : 'N/A'}
- Duration: ${formatDuration(report.duration_seconds)}

Assessment:
- Cleanliness Rating: ${report.cleanliness_rating}/5 stars
- Damage Question: ${report.damage_question}
- Checklist Completion: ${getChecklistCompletionPercentage(report.checklist_items)}%

Cleaning Checklist:
${Object.entries(report.checklist_items || {}).map(([key, value]) => 
  `- ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${value ? '✓' : '✗'}`
).join('\n')}

Missing Items/Issues:
${report.missing_items_details || 'None reported'}

Images:
- Damage Images: ${report.damage_images?.length || 0} files
- Post-Cleaning Images: ${report.post_cleaning_images?.length || 0} files

Generated on: ${format(new Date(), 'MMMM d, yyyy h:mm a')}
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job-report-${report.listing_name}-${report.completion_date}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-8">
            <p className="text-gray-500">Report not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Job Completion Report</h1>
                <p className="text-sm text-gray-600">
                  {(() => {
                    const reportDate = parseCompletionDate(report.completion_date);
                    return reportDate ? format(reportDate, 'MMMM d, yyyy') : report.completion_date;
                  })()}
                </p>
              </div>
            </div>
            <Button onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>

          {/* Job Information */}
          <Card>
            <CardHeader>
              <CardTitle>Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Property</h3>
                  <p className="text-gray-600">{report.listing_name}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Cleaner</h3>
                  <p className="text-gray-600">{report.cleaner?.name || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Date</h3>
                  <p className="text-gray-600">
                    {(() => {
                      const reportDate = parseCompletionDate(report.completion_date);
                      return reportDate ? format(reportDate, 'MMMM d, yyyy') : report.completion_date;
                    })()}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Assignment Hours</h3>
                  <p className="text-gray-600">{report.assignment?.hours || 'N/A'}h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Timing Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h3 className="font-medium text-gray-900">Start Time</h3>
                  <p className="text-gray-600">
                    {report.start_time ? format(new Date(report.start_time), 'h:mm a') : 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">End Time</h3>
                  <p className="text-gray-600">
                    {report.end_time ? format(new Date(report.end_time), 'h:mm a') : 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Total Duration</h3>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatDuration(report.duration_seconds)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assessment */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Cleanliness Rating</h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-6 w-6 ${
                            star <= report.cleanliness_rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-semibold">{report.cleanliness_rating}/5</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Damage Reported</h3>
                  <Badge
                    variant={report.damage_question === 'Yes' ? 'destructive' : 
                           report.damage_question === 'Maybe' ? 'secondary' : 'default'}
                    className="text-sm"
                  >
                    {report.damage_question === 'Yes' && <AlertTriangle className="h-4 w-4 mr-1" />}
                    {report.damage_question}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cleaning Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Cleaning Checklist
                <Badge variant="outline">
                  {getChecklistCompletionPercentage(report.checklist_items)}% Complete
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(report.checklist_items || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-3">
                    {value ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`${value ? 'text-gray-900' : 'text-gray-500'}`}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Missing Items & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Missing Items & Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {report.missing_items_details || 'No missing items or additional notes reported.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          {(report.damage_images?.length > 0 || report.post_cleaning_images?.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence Images</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Damage Images */}
                {report.damage_images && report.damage_images.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                      Damage Images ({report.damage_images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {report.damage_images.map((imageUrl, index) => (
                        <div key={index} className="relative">
                          <img
                            src={imageUrl}
                            alt={`Damage evidence ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => window.open(imageUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post-Cleaning Images */}
                {report.post_cleaning_images && report.post_cleaning_images.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      Post-Cleaning Images ({report.post_cleaning_images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {report.post_cleaning_images.map((imageUrl, index) => (
                        <div key={index} className="relative">
                          <img
                            src={imageUrl}
                            alt={`Post-cleaning evidence ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2"
                            onClick={() => window.open(imageUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Report Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Report Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Report ID:</span> {report.id}
                </div>
                <div>
                  <span className="font-medium">Assignment ID:</span> {report.assignment_uuid}
                </div>
                <div>
                  <span className="font-medium">Submitted:</span>{' '}
                  {format(new Date(report.created_at), 'MMM d, yyyy h:mm a')}
                </div>
                <div>
                  <span className="font-medium">Checkout Type:</span>{' '}
                  {report.assignment?.event?.checkout_type || 'N/A'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 