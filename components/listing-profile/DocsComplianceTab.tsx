'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Download, Trash2, Loader2, Image as ImageIcon, Shield, AlertCircle, CheckCircle, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { ListingDocument, ListingComplianceDocument } from '@/lib/models';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface DocsComplianceTabProps {
  listingId: string;
  listingName: string;
}

const COMPLIANCE_TYPES = [
  { id: 'gas_cert', label: 'Gas Certificate', icon: '🔥', requiresExpiry: true },
  { id: 'eicr', label: 'EICR', icon: '⚡', requiresExpiry: true },
  { id: 'pat_test', label: 'PAT Test', icon: '🔌', requiresExpiry: true },
  { id: 'insurance', label: 'Insurance Certificate', icon: '🛡️', requiresExpiry: true },
  { id: 'fire_risk', label: 'Fire Risk Assessment', icon: '🧯', requiresExpiry: true },
  { id: 'ownership', label: 'Ownership/Landlord Agreement', icon: '📋', requiresExpiry: false },
] as const;

export function DocsComplianceTab({ listingId, listingName }: DocsComplianceTabProps) {
  const [complianceDocs, setComplianceDocs] = useState<Record<string, ListingComplianceDocument>>({});
  const [documents, setDocuments] = useState<ListingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadComplianceDocs();
    loadDocuments();
  }, [listingId]);

  const loadComplianceDocs = async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}/compliance`);
      const data = await response.json();
      
      if (data.success) {
        // Convert array to object keyed by compliance_type
        const docsObj: Record<string, ListingComplianceDocument> = {};
        data.documents.forEach((doc: ListingComplianceDocument) => {
          docsObj[doc.compliance_type] = doc;
        });
        setComplianceDocs(docsObj);
      }
    } catch (error) {
      console.error('Error loading compliance documents:', error);
      toast.error('Failed to load compliance documents');
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/documents`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const getComplianceStatus = (doc?: ListingComplianceDocument) => {
    if (!doc || !doc.expiry_date || doc.expiry_date === '') return { status: 'none', label: 'Not Uploaded', color: 'gray' };
    
    const expiryDate = parseISO(doc.expiry_date);
    const today = new Date();
    const daysUntilExpiry = differenceInDays(expiryDate, today);

    if (daysUntilExpiry < 0) {
      return { status: 'expired', label: 'Expired', color: 'red', icon: <AlertCircle className="h-4 w-4" /> };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', label: 'Expiring Soon', color: 'yellow', icon: <Clock className="h-4 w-4" /> };
    } else {
      return { status: 'valid', label: 'Valid', color: 'green', icon: <CheckCircle className="h-4 w-4" /> };
    }
  };

  const handleComplianceUpload = async (complianceType: string, file: File, expiryDate?: string) => {
    setIsUploading(complianceType);
    
    try {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File is too large (max 10MB)');
        return;
      }

      // Convert file to base64
      const base64 = await fileToBase64(file);
      
      // Upload to Cloudinary
      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: base64,
          folder: `listings/${listingName}/compliance`,
          fileName: `${listingId}-${complianceType}-${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}`
        })
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadResponse.json();

      // Save to database with compliance API
      const saveResponse = await fetch(`/api/listings/${listingId}/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compliance_type: complianceType,
          expiry_date: expiryDate || null,
          file_url: uploadData.url,
          file_name: file.name,
          file_size: file.size
        })
      });

      const saveData = await saveResponse.json();

      if (!saveData.success) {
        throw new Error(saveData.error || 'Failed to save document metadata');
      }

      toast.success(`${file.name} uploaded successfully${saveData.reminder_created ? ' and reminder created' : ''}`);
      await loadComplianceDocs();
    } catch (error) {
      console.error('Error uploading compliance document:', error);
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(null);
    }
  };

  const handleComplianceDelete = async (complianceType: string, docId: string) => {
    if (!confirm('Are you sure you want to delete this compliance document? Any associated reminders will also be deleted.')) {
      return;
    }

    try {
      const response = await fetch(`/api/listings/${listingId}/compliance/${docId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Document deleted successfully');
        await loadComplianceDocs();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error deleting compliance document:', error);
      toast.error('Failed to delete document');
    }
  };

  const handleExpiryDateChange = async (complianceType: string, docId: string, newExpiryDate: string) => {
    try {
      const response = await fetch(`/api/listings/${listingId}/compliance/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiry_date: newExpiryDate
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Expiry date updated and reminder refreshed');
        await loadComplianceDocs();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error updating expiry date:', error);
      toast.error('Failed to update expiry date');
    }
  };

  // General documents functions (existing functionality)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleGeneralDocUpload(files);
    }
  }, [listingId]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleGeneralDocUpload(files);
    }
    e.target.value = '';
  };

  const handleGeneralDocUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        const base64 = await fileToBase64(file);
        
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            folder: `listings/${listingName}`,
            fileName: `${listingId}-${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}`
          })
        });

        if (!uploadResponse.ok) throw new Error('Upload failed');

        const uploadData = await uploadResponse.json();

        const saveResponse = await fetch(`/api/listings/${listingId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_url: uploadData.url,
            file_type: 'other',
            file_size: file.size
          })
        });

        const saveData = await saveResponse.json();

        if (!saveData.success) throw new Error(saveData.error);

        toast.success(`${file.name} uploaded successfully`);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    
    await loadDocuments();
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`/api/listings/${listingId}/documents/${documentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Document deleted successfully');
        await loadDocuments();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const getFileIcon = (fileType: string | null | undefined, fileName: string) => {
    if (fileType === 'photo' || ['jpg', 'jpeg', 'png', 'gif'].includes(fileName.split('.').pop()?.toLowerCase() || '')) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">
      {/* Compliance Tracking Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-2xl font-bold">Compliance Tracking</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Upload and track compliance documents with automatic expiry reminders (30 days before expiry)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COMPLIANCE_TYPES.map((type) => {
            const doc = complianceDocs[type.id];
            const status = getComplianceStatus(doc);
            
            return (
              <Card key={type.id} className={cn(
                "relative overflow-hidden transition-shadow hover:shadow-md",
                status.status === 'expired' && "border-red-300",
                status.status === 'expiring' && "border-yellow-300",
                status.status === 'valid' && "border-green-300"
              )}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{type.icon}</span>
                      <CardTitle className="text-base">{type.label}</CardTitle>
                    </div>
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-xs",
                        status.status === 'expired' && "bg-red-50 text-red-700 border-red-300",
                        status.status === 'expiring' && "bg-yellow-50 text-yellow-700 border-yellow-300",
                        status.status === 'valid' && "bg-green-50 text-green-700 border-green-300",
                        status.status === 'none' && "bg-gray-50 text-gray-700 border-gray-300"
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {status.icon}
                        {status.label}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {doc ? (
                    <>
                      {type.requiresExpiry && doc.expiry_date && (
                        <div className="space-y-2">
                          <Label htmlFor={`expiry-${type.id}`} className="text-xs">Expiry Date</Label>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <Input
                              id={`expiry-${type.id}`}
                              type="date"
                              value={doc.expiry_date.split('T')[0]}
                              onChange={(e) => handleExpiryDateChange(type.id, doc.id, e.target.value)}
                              className="text-sm"
                            />
                          </div>
                          <p className="text-xs text-gray-500">
                            {doc.expiry_date && doc.expiry_date !== '' ? (
                              <>
                                {format(parseISO(doc.expiry_date), 'dd-MM-yyyy')} 
                                ({differenceInDays(parseISO(doc.expiry_date), new Date())} days)
                              </>
                            ) : 'N/A'}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleComplianceDelete(type.id, doc.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <Label htmlFor={`replace-${type.id}`} className="cursor-pointer">
                        <div className="text-xs text-center text-blue-600 hover:text-blue-700 border border-dashed border-blue-300 rounded p-2">
                          Replace Document
                        </div>
                        <Input
                          id={`replace-${type.id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const expiry = type.requiresExpiry ? prompt('Enter expiry date (YYYY-MM-DD):') : undefined;
                              await handleComplianceUpload(type.id, file, expiry || undefined);
                            }
                            e.target.value = '';
                          }}
                          disabled={isUploading === type.id}
                        />
                      </Label>
                    </>
                  ) : (
                    <>
                      {type.requiresExpiry && (
                        <p className="text-xs text-gray-500">
                          Upload will create automatic reminder 30 days before expiry
                        </p>
                      )}
                      
                      <Label htmlFor={`upload-${type.id}`} className="cursor-pointer">
                        <div className={cn(
                          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                          isUploading === type.id ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                        )}>
                          {isUploading === type.id ? (
                            <Loader2 className="h-6 w-6 mx-auto animate-spin text-blue-600" />
                          ) : (
                            <Upload className="h-6 w-6 mx-auto text-gray-400" />
                          )}
                          <p className="text-xs mt-2 text-gray-600">
                            {isUploading === type.id ? 'Uploading...' : 'Click to upload'}
                          </p>
                        </div>
                        <Input
                          id={`upload-${type.id}`}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const expiry = type.requiresExpiry ? prompt('Enter expiry date (YYYY-MM-DD):') : undefined;
                              await handleComplianceUpload(type.id, file, expiry || undefined);
                            }
                            e.target.value = '';
                          }}
                          disabled={isUploading === type.id}
                        />
                      </Label>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* General Documents Section (Existing Functionality) */}
      <Card>
        <CardHeader>
          <CardTitle>General Documents & Photos</CardTitle>
          <p className="text-sm text-gray-500">
            Upload contracts, photos, and other general documents
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            )}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Maximum file size: 10MB
            </p>
            <Label htmlFor="general-file-upload" className="cursor-pointer">
              <Button type="button" variant="outline" asChild>
                <span>Browse Files</span>
              </Button>
            </Label>
            <Input
              id="general-file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Documents List */}
          {isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No general documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(doc.file_type, doc.file_name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)} • Uploaded {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(doc.file_url, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDocumentDelete(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

