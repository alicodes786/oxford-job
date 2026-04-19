'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Download, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ListingDocument } from '@/lib/models';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DocumentsTabProps {
  listingId: string;
  listingName: string;
}

export function DocumentsTab({ listingId, listingName }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<ListingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [listingId]);

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
      await handleFiles(files);
    }
  }, [listingId]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await handleFiles(files);
    }
    // Reset input
    e.target.value = '';
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    
    for (const file of files) {
      try {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          continue;
        }

        // Convert file to base64
        const base64 = await fileToBase64(file);
        
        // Upload to Cloudinary
        const uploadResponse = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            folder: `listings/${listingName}`,
            fileName: `${listingId}-${Date.now()}-${file.name.replace(/\.[^/.]+$/, '')}`
          })
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Upload failed');
        }

        // Determine file type
        const fileType = detectFileType(file.name);

        // Save document metadata
        const saveResponse = await fetch(`/api/listings/${listingId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_url: uploadData.url,
            file_type: fileType,
            file_size: file.size
          })
        });

        const saveData = await saveResponse.json();

        if (saveData.success) {
          toast.success(`${file.name} uploaded successfully`);
        } else {
          throw new Error('Failed to save document metadata');
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    loadDocuments();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const detectFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) return 'photo';
    if (extension === 'pdf') {
      if (fileName.toLowerCase().includes('contract')) return 'contract';
      if (fileName.toLowerCase().includes('epc')) return 'epc';
      if (fileName.toLowerCase().includes('insurance')) return 'insurance';
      if (fileName.toLowerCase().includes('certificate')) return 'certificate';
      return 'other';
    }
    return 'other';
  };

  const handleDelete = async (documentId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    try {
      const response = await fetch(`/api/listings/${listingId}/documents/${documentId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Document deleted');
        loadDocuments();
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents & Photos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-accent/50",
              isDragging && "border-primary bg-accent/50",
              isUploading && "pointer-events-none opacity-50"
            )}
          >
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <Label htmlFor="file-upload" className="cursor-pointer">
              {isUploading ? (
                <>
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  <p className="text-sm">Uploading...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm">Drag & drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, JPG, PNG (max 10MB each)
                  </p>
                </>
              )}
            </Label>
          </div>

          {/* Documents List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No documents uploaded yet. Drag & drop files above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold">Uploaded Files</h3>
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {getFileIcon(doc.file_type, doc.file_name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.file_size)} • Uploaded {format(new Date(doc.uploaded_at), 'MMM dd, yyyy')}
                        {doc.file_type && doc.file_type !== 'other' && (
                          <span className="ml-2 capitalize">• {doc.file_type}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id, doc.file_name)}
                      className="text-red-500 hover:text-red-700"
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

