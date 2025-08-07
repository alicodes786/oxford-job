'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Upload, Star, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface CleaningChecklistFormProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: {
    uuid: string;
    cleaner_uuid: string;
    event?: {
      listing_name: string;
      checkout_date: string;
    };
    hours: number;
  };
}

interface FormData {
  date: string;
  listingName: string;
  cleanlinessRating: number;
  damageQuestion: 'Yes' | 'No' | 'Maybe' | '';
  damageImages: File[];
  checklistItems: {
    remoteInUnit: boolean;
    ironInUnit: boolean;
    hairDryerInUnit: boolean;
    newBeddingClean: boolean;
    bathroomClean: boolean;
    hotWaterWorking: boolean;
    heatingWorking: boolean;
    floorsCleanedAndHoovered: boolean;
    cutleryCheck: boolean;
    towelsChecked: boolean;
    keysLeftInBox: boolean;
  };
  missingItemsDetails: string;
  postCleaningImages: File[];
}

export function CleaningChecklistForm({ isOpen, onClose, assignment }: CleaningChecklistFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  
  // Test mode - set to true to skip image uploads entirely
  const TEST_MODE_SKIP_IMAGES = false;

  const [formData, setFormData] = useState<FormData>({
    date: format(new Date(), 'yyyy-MM-dd'),  // Changed to ISO format
    listingName: assignment.event?.listing_name || '',
    cleanlinessRating: 0,
    damageQuestion: '',
    damageImages: [],
    checklistItems: {
      remoteInUnit: false,
      ironInUnit: false,
      hairDryerInUnit: false,
      newBeddingClean: false,
      bathroomClean: false,
      hotWaterWorking: false,
      heatingWorking: false,
      floorsCleanedAndHoovered: false,
      cutleryCheck: false,
      towelsChecked: false,
      keysLeftInBox: false,
    },
    missingItemsDetails: '',
    postCleaningImages: [],
  });

  // Start timer when form opens
  useEffect(() => {
    let mounted = true;

    const startTimer = async () => {
      // Check if timer already exists
      try {
        const checkResponse = await fetch('/api/job-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignment_uuid: assignment.uuid,
            cleaner_uuid: assignment.cleaner_uuid,
          }),
        });

        if (!mounted) return;

        const data = await checkResponse.json();
        if (data.success) {
          setTimerStarted(true);
          console.log('Timer started or retrieved:', data.timer);
        } else {
          console.error('Failed to start timer:', data.error);
          toast.error('Failed to start timer: ' + data.error);
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Error starting timer:', error);
        toast.error('Failed to start timer');
      }
    };

    if (isOpen && !timerStarted) {
      startTimer();
    }

    return () => {
      mounted = false;
    };
  }, [isOpen, assignment.uuid, assignment.cleaner_uuid, timerStarted]);

  // Reset timer state when form closes
  useEffect(() => {
    if (!isOpen) {
      setTimerStarted(false);
    }
  }, [isOpen]);

  // Handle file uploads
  const handleFileUpload = (files: FileList | null, field: 'damageImages' | 'postCleaningImages') => {
    if (files) {
      const fileArray = Array.from(files);
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], ...fileArray]
      }));
    }
  };

  // Remove uploaded file
  const removeFile = (index: number, field: 'damageImages' | 'postCleaningImages') => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Handle checklist item change
  const handleChecklistChange = (item: keyof FormData['checklistItems']) => {
    setFormData(prev => ({
      ...prev,
      checklistItems: {
        ...prev.checklistItems,
        [item]: !prev.checklistItems[item]
      }
    }));
  };

  // Upload images to Supabase Storage
  const uploadImages = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    
    // Skip all permission checks - just try uploading directly
    console.log('Skipping bucket checks, attempting direct upload...');
    
    for (const file of files) {
      try {
        console.log(`Uploading file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
        
        // Validate file
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          throw new Error(`File ${file.name} is too large (max 10MB)`);
        }
        
        // Create unique filename with timestamp
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${assignment.uuid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        console.log(`Uploading to path: ${fileName}`);
        
        // Upload file to Supabase Storage
        const { data, error } = await supabase.storage
          .from('job-completions')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (error) {
          console.error('Supabase upload error details:', {
            message: error.message,
            details: error,
            fileName: fileName,
            bucketId: 'job-completions'
          });
          
          // If it's an RLS error, provide helpful info
          if (error.message.includes('row-level security') || error.message.includes('policy')) {
            throw new Error(`RLS Policy Error: ${error.message}. Please run the storage policies SQL script.`);
          }
          
          throw new Error(`Upload failed: ${error.message || 'Unknown error'}`);
        }
        
        console.log('Upload successful:', data);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('job-completions')
          .getPublicUrl(fileName);
        
        console.log('Generated public URL:', publicUrl);
        urls.push(publicUrl);
        
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
        throw error;
      }
    }
    
    return urls;
  };

  // Handle job completion
  const handleJobEnd = async () => {
    // Validate required fields
    if (!formData.listingName.trim()) {
      toast.error('Please enter a listing name');
      return;
    }
    
    if (formData.cleanlinessRating === 0) {
      toast.error('Please rate how clean the guest left the unit');
      return;
    }
    
    if (!formData.damageQuestion) {
      toast.error('Please answer the damage question');
      return;
    }
    
    if (!formData.missingItemsDetails.trim()) {
      toast.error('Please provide details on missing items (or enter N/A)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload images first if any exist
      let damageImageUrls: string[] = [];
      let postCleaningImageUrls: string[] = [];

      if (formData.damageImages.length > 0 && !TEST_MODE_SKIP_IMAGES) {
        setIsUploadingImages(true);
        damageImageUrls = await uploadImages(formData.damageImages, 'damage-images');
      }

      if (formData.postCleaningImages.length > 0 && !TEST_MODE_SKIP_IMAGES) {
        setIsUploadingImages(true);
        postCleaningImageUrls = await uploadImages(formData.postCleaningImages, 'post-cleaning');
      }

      setIsUploadingImages(false);

      // Map checklist items to the correct format
      const checklistItems = {
        remote_in_unit: formData.checklistItems.remoteInUnit,
        iron_in_unit: formData.checklistItems.ironInUnit,
        hair_dryer_in_unit: formData.checklistItems.hairDryerInUnit,
        new_bedding_clean: formData.checklistItems.newBeddingClean,
        bathroom_clean: formData.checklistItems.bathroomClean,
        hot_water_working: formData.checklistItems.hotWaterWorking,
        heating_working: formData.checklistItems.heatingWorking,
        floors_cleaned_and_hoovered: formData.checklistItems.floorsCleanedAndHoovered,
        cutlery_check: formData.checklistItems.cutleryCheck,
        towels_checked: formData.checklistItems.towelsChecked,
        keys_left_in_box: formData.checklistItems.keysLeftInBox,
      };

      // Submit completion data
      const response = await fetch('/api/job-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_uuid: assignment.uuid,
          cleaner_uuid: assignment.cleaner_uuid,
          date: formData.date,
          listing_name: formData.listingName,
          cleanliness_rating: formData.cleanlinessRating,
          damage_question: formData.damageQuestion,
          damage_images: damageImageUrls,
          checklist_items: checklistItems,
          missing_items_details: formData.missingItemsDetails,
          post_cleaning_images: postCleaningImageUrls,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Job completed successfully! Duration: ${data.duration_minutes} minutes`);
        setTimerStarted(false);
        onClose();
      } else {
        // If timer not found, try to start it again
        if (data.error?.includes('No timer found')) {
          toast.error('Timer was lost. Please try ending the job again.');
          setTimerStarted(false);
          return;
        }
        throw new Error(data.error || 'Failed to complete job');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete job');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImages(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Job Completion Form</DialogTitle>
        </DialogHeader>

        {/* Form content */}
        <div className="space-y-6">
          {/* Date and Listing Name */}
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="date">Today's Date *</Label>
                <Input
                  id="date"
                  value={formData.date}
                  readOnly
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="listingName">Listing Name/Reference *</Label>
                <Input
                  id="listingName"
                  value={formData.listingName}
                  readOnly
                  className="mt-1"
                />
              </div>
            </div>
          </Card>

          {/* Cleanliness Rating */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Guest Condition Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>How dirty or clean did the guest leave the unit? *</Label>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cleanlinessRating: star }))}
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= formData.cleanlinessRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Was there any notable damage? *</Label>
                <div className="flex gap-2 mt-2">
                  {['Yes', 'No', 'Maybe'].map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={formData.damageQuestion === option ? 'default' : 'outline'}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        damageQuestion: option as 'Yes' | 'No' | 'Maybe'
                      }))}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>

              {formData.damageQuestion === 'Yes' && (
                <div>
                  <Label>Upload pictures of damage</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => handleFileUpload(e.target.files, 'damageImages')}
                      className="hidden"
                      id="damage-upload"
                    />
                    <label htmlFor="damage-upload" className="cursor-pointer">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400">
                        <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Upload file</p>
                        <p className="text-xs text-gray-400">File limit: 10 | Single file size limit: 100MB</p>
                      </div>
                    </label>
                    {formData.damageImages.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {formData.damageImages.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center gap-3">
                              {file.type.startsWith('image/') && (
                                <img 
                                  src={URL.createObjectURL(file)} 
                                  alt="Preview" 
                                  className="w-12 h-12 object-cover rounded border"
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium truncate max-w-[150px]">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index, 'damageImages')}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cleaning Checklist */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Cleaning Checklist</CardTitle>
              <p className="text-sm text-gray-600">Please confirm you have checked the following items: *</p>
            </CardHeader>
            <CardContent>
                             <div className="grid grid-cols-1 gap-4">
                 {[
                   { key: 'remoteInUnit', label: 'Remote in Unit' },
                   { key: 'ironInUnit', label: 'Iron in Unit' },
                   { key: 'hairDryerInUnit', label: 'Hair dryer in Unit' },
                   { key: 'newBeddingClean', label: 'New bedding is clean' },
                   { key: 'bathroomClean', label: 'Bathroom - including WC/Sink are Clean' },
                   { key: 'hotWaterWorking', label: 'Hot water working' },
                   { key: 'heatingWorking', label: 'Heating working' },
                   { key: 'floorsCleanedAndHoovered', label: 'Floors mopped and hoovered' },
                   { key: 'cutleryCheck', label: 'Cutlery Check - confirm correct number of items are in the unit - in case of anything missing- please enter below.' },
                   { key: 'towelsChecked', label: 'Correct number of towels left + towels checked for stains.' },
                   { key: 'keysLeftInBox', label: 'If applicable- Keys Left back in the Box (185/ SC/ SA/ SW12)' },
                 ].map((item) => (
                   <label key={item.key} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                     <input
                       type="checkbox"
                       checked={formData.checklistItems[item.key as keyof FormData['checklistItems']]}
                       onChange={() => handleChecklistChange(item.key as keyof FormData['checklistItems'])}
                       className="mt-1 h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                     />
                     <span className="text-sm leading-relaxed">{item.label}</span>
                   </label>
                 ))}
               </div>
            </CardContent>
          </Card>

          {/* Missing Items */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Additional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="missingItems">Details on Missing Items / Cutlery / Other issues noted. (N/A if none) *</Label>
                <Textarea
                  id="missingItems"
                  value={formData.missingItemsDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, missingItemsDetails: e.target.value }))}
                  placeholder="Enter your answer"
                  rows={3}
                />
              </div>

              <div>
                <Label>Add pictures or video post cleaning. Notable area (Bed , WC, Kitchen)</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => handleFileUpload(e.target.files, 'postCleaningImages')}
                    className="hidden"
                    id="post-cleaning-upload"
                  />
                  <label htmlFor="post-cleaning-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">Upload file</p>
                      <p className="text-xs text-gray-400">File limit: 10 | Single file size limit: 1GB</p>
                    </div>
                  </label>
                  {formData.postCleaningImages.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {formData.postCleaningImages.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex items-center gap-3">
                            {file.type.startsWith('image/') && (
                              <img 
                                src={URL.createObjectURL(file)} 
                                alt="Preview" 
                                className="w-12 h-12 object-cover rounded border"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium truncate max-w-[150px]">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index, 'postCleaningImages')}
                            className="text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Job End Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleJobEnd}
              disabled={isSubmitting || isUploadingImages}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
            >
              {isUploadingImages ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                  Uploading Images...
                </>
              ) : isSubmitting ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                  Completing Job...
                </>
              ) : (
                'Job End'
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleJobEnd} 
            disabled={isSubmitting}
            className="ml-2"
          >
            {isSubmitting ? 'Submitting...' : 'Complete Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 