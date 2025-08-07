'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Download, Save } from 'lucide-react';

interface IcalEntry {
  id: string;
  url: string;
  name: string;
  isDetected: boolean;
  isValidated: boolean;
}

export default function BulkImportPage() {
  const [entries, setEntries] = useState<IcalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pastedUrls, setPastedUrls] = useState('');
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  // Add an empty entry
  const addEmptyEntry = () => {
    setEntries([
      ...entries,
      {
        id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: '',
        name: '',
        isDetected: false,
        isValidated: false
      }
    ]);
  };

  // Remove an entry
  const removeEntry = (id: string) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  // Update an entry's URL
  const updateUrl = (id: string, url: string) => {
    setEntries(
      entries.map(entry => 
        entry.id === id ? { ...entry, url, isValidated: false } : entry
      )
    );
  };

  // Update an entry's name
  const updateName = (id: string, name: string) => {
    setEntries(
      entries.map(entry => 
        entry.id === id ? { ...entry, name, isDetected: false } : entry
      )
    );
  };

  // Validate and detect name for a single entry
  const validateEntry = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry || !entry.url) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/fetch-ical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: entry.url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate iCal URL');
      }

      // Set the detected name if available
      if (data.detectedListingName && !entry.name) {
        setEntries(
          entries.map(e => 
            e.id === id ? 
              { 
                ...e, 
                name: data.detectedListingName, 
                isDetected: true, 
                isValidated: true 
              } : e
          )
        );
        toast.success(`Detected name: ${data.detectedListingName}`);
      } else {
        setEntries(
          entries.map(e => 
            e.id === id ? { ...e, isValidated: true } : e
          )
        );
        toast.success('iCal URL validated');
      }
    } catch (error) {
      console.error('Error validating iCal URL:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to validate iCal URL');
    } finally {
      setIsLoading(false);
    }
  };

  // Parse multiple URLs from pasted text
  const parseUrlsFromText = () => {
    if (!pastedUrls.trim()) {
      toast.error('Please paste URLs first');
      return;
    }

    // Split by newlines and process each line
    const lines = pastedUrls.split('\n').filter(line => line.trim());
    
    const newEntries: IcalEntry[] = lines.map(line => {
      // Try to extract URL and name if formatted as "name: url" or similar
      const nameUrlMatch = line.match(/^(.+?)[\s:,-]+(.+)$/);
      
      if (nameUrlMatch && nameUrlMatch[2].includes('http')) {
        return {
          id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: nameUrlMatch[2].trim(),
          name: nameUrlMatch[1].trim(),
          isDetected: false,
          isValidated: false
        };
      } else if (line.includes('http')) {
        // Just a URL with no name
        return {
          id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url: line.trim(),
          name: '',
          isDetected: false,
          isValidated: false
        };
      }
      return null;
    }).filter(Boolean) as IcalEntry[];

    if (newEntries.length > 0) {
      setEntries([...entries, ...newEntries]);
      setPastedUrls('');
      toast.success(`Added ${newEntries.length} new entries`);
    } else {
      toast.error('No valid URLs found in the pasted text');
    }
  };

  // Validate all entries at once
  const validateAllEntries = async () => {
    if (entries.length === 0) {
      toast.error('No entries to validate');
      return;
    }

    setIsLoading(true);
    
    try {
      // Process entries in sequence to avoid overwhelming the server
      for (const entry of entries) {
        if (!entry.url) continue;
        
        try {
          const response = await fetch('/api/fetch-ical', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: entry.url }),
          });

          const data = await response.json();

          if (response.ok && data.detectedListingName && !entry.name) {
            setEntries(prev => 
              prev.map(e => 
                e.id === entry.id ? 
                  { 
                    ...e, 
                    name: data.detectedListingName, 
                    isDetected: true, 
                    isValidated: true 
                  } : e
              )
            );
          } else if (response.ok) {
            setEntries(prev => 
              prev.map(e => 
                e.id === entry.id ? { ...e, isValidated: true } : e
              )
            );
          }
        } catch (error) {
          console.error(`Error validating entry ${entry.id}:`, error);
          // Continue with other entries even if one fails
        }
      }
      
      toast.success('Finished validating all entries');
    } catch (error) {
      console.error('Error in bulk validation:', error);
      toast.error('Failed to validate all entries');
    } finally {
      setIsLoading(false);
    }
  };

  // Save all entries to calendar
  const saveToCalendar = async () => {
    if (entries.length === 0) {
      toast.error('No entries to save');
      return;
    }

    const entriesToSave = entries.filter(entry => entry.url && (entry.name || entry.isDetected));
    
    if (entriesToSave.length === 0) {
      toast.error('All entries must have a URL and name');
      return;
    }

    setIsLoading(true);
    
    try {
      // First, retrieve any existing listings from localStorage
      let existingListings: any[] = [];
      if (isClient) {
        const savedListings = localStorage.getItem('airbnbListings');
        if (savedListings) {
          existingListings = JSON.parse(savedListings);
        }
      }
      
      // Convert our entries to the listing format used by the calendar
      const newListings = entriesToSave.map(entry => ({
        id: `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: entry.name,
        icalUrl: entry.url
      }));
      
      // Combine existing and new listings
      const combinedListings = [...existingListings, ...newListings];
      
      // Save to localStorage
      if (isClient) {
        localStorage.setItem('airbnbListings', JSON.stringify(combinedListings));
      }
      
      toast.success(`Added ${newListings.length} listings to your calendar`);
      
      // Redirect back to the calendar page
      setTimeout(() => {
        router.push('/dashboard/calendar');
      }, 1500);
    } catch (error) {
      console.error('Error saving listings:', error);
      toast.error('Failed to save listings');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize with one empty entry
  useEffect(() => {
    setIsClient(true);
    if (entries.length === 0) {
      addEmptyEntry();
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Import iCal Feeds</h1>
          <p className="text-muted-foreground">
            Add multiple Airbnb iCal feeds at once and view them on your calendar.
          </p>
        </div>
        <div>
          <Link href="/dashboard/calendar">
            <Button variant="outline">Back to Calendar</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Paste</CardTitle>
          <CardDescription>
            Paste multiple iCal URLs at once (one per line). If formatted as "name: url", we'll extract both.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full h-32 p-2 border rounded-md"
              placeholder="Paste URLs here, one per line. Format as 'name: url' for automatic naming."
              value={pastedUrls}
              onChange={(e) => setPastedUrls(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                onClick={parseUrlsFromText}
                disabled={isLoading || !pastedUrls.trim()}
              >
                <Download className="h-4 w-4 mr-2" />
                Process URLs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>iCal Feeds</CardTitle>
              <CardDescription>
                Add your iCal feed URLs and give each listing a name.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={validateAllEntries}
                disabled={isLoading || entries.length === 0}
              >
                Validate All
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                onClick={addEmptyEntry}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {entries.map((entry, index) => (
              <div key={entry.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="iCal URL"
                    value={entry.url}
                    onChange={(e) => updateUrl(entry.id, e.target.value)}
                    className={entry.isValidated ? "border-green-500" : ""}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Listing Name"
                    value={entry.name}
                    onChange={(e) => updateName(entry.id, e.target.value)}
                    className={entry.isDetected ? "border-blue-500" : ""}
                  />
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={isLoading || !entry.url}
                    onClick={() => validateEntry(entry.id)}
                  >
                    Validate
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    disabled={isLoading || entries.length <= 1}
                    onClick={() => removeEntry(entry.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={saveToCalendar}
              disabled={isLoading || entries.every(e => !e.url || !e.name)}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save to Calendar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 