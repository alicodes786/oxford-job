'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';

// Add the NormalizedEvent type definition
type NormalizedEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  listing: string;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
};

// Update the ValidationResult type to include all previous properties
type ValidationResult = {
  isValid: boolean;
  isBalanced?: boolean;
  lastSyncTime: string;
  syncStatus: string;
  eventCounts: {
    database: {
      total: number;
      checkIns: number;
      checkOuts: number;
    };
    calendar: {
      total: number;
      checkIns: number;
      checkOuts: number;
    };
    ical?: {
      total: number;
      checkIns: number;
      checkOuts: number;
    };
  };
  differences: {
    missingFromCalendar: number;
    extraInCalendar: number;
    listingsMissingEvents: string[];
    // Add new properties for iCal comparison
    missingFromDb?: number;
    extraInDb?: number;
  };
  samples: {
    missingFromCalendar: Array<NormalizedEvent>;
    extraInCalendar: Array<NormalizedEvent>;
    // Add new property for iCal samples
    missingFromDb?: Array<NormalizedEvent>;
  };
  // Add new properties for imbalanced listings and iCal sources
  imbalancedListings?: Array<{
    listing: string;
    checkIns: number;
    checkOuts: number;
    difference: number;
  }>;
  icalSources?: {
    feedsProcessed: number;
    sources: Array<{
      listing: string;
      feedName: string;
      eventsCount: number;
    }>;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  recommendations: string[];
};

function SyncTestContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [compareWithIcal, setCompareWithIcal] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    toast.loading('Running calendar sync validation...', { id: 'sync-test' });
    
    try {
      // Add compareIcal parameter to URL if enabled
      const url = compareWithIcal 
        ? '/api/test/sync-validation?compareIcal=true' 
        : '/api/test/sync-validation';
        
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run validation test');
      }
      
      setResult(data);
      
      if (data.isValid && data.isBalanced) {
        toast.success('Calendar validation passed! All events are properly synced.', { id: 'sync-test' });
      } else if (!data.isValid) {
        toast.error(`Validation found ${data.differences.missingFromCalendar} missing events.`, { id: 'sync-test' });
      } else if (!data.isBalanced) {
        toast.error(`Found ${data.imbalancedListings?.length || 0} listings with imbalanced check-ins/check-outs.`, { id: 'sync-test' });
      }
    } catch (error) {
      console.error('Error running sync validation:', error);
      toast.error('Failed to run sync validation test', { id: 'sync-test' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  return (
    <div className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar Sync Validation</h1>
            <p className="text-muted-foreground">
              Validate that calendar events match the latest synced database entries.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="compare-ical"
                checked={compareWithIcal}
                onChange={(e) => setCompareWithIcal(e.target.checked)}
                className="mr-2 h-4 w-4"
              />
              <label htmlFor="compare-ical" className="text-sm">
                Compare with iCal sources (slower)
              </label>
            </div>
            <Button 
              onClick={runTest}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {isLoading ? 'Running Test...' : 'Run Validation Test'}
            </Button>
          </div>
        </div>

        {result && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Validation Results</CardTitle>
                <Badge variant={result.isValid ? "outline" : "destructive"} className={result.isValid ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                  {result.isValid ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <X className="h-3 w-3" />
                      Issues Found
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription>
                Last sync: {new Date(result.lastSyncTime).toLocaleString()} ({result.syncStatus})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Event Counts Section */}
              <div>
                <h3 className="font-semibold mb-2 flex justify-between items-center">
                  <span>Event Counts</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-1">Database</div>
                    <div className="text-2xl font-bold">{result.eventCounts.database.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.eventCounts.database.checkIns} check-ins, {result.eventCounts.database.checkOuts} check-outs
                    </div>
                  </div>
                  <div className="border rounded-md p-3">
                    <div className="text-sm font-medium mb-1">Calendar View</div>
                    <div className="text-2xl font-bold">{result.eventCounts.calendar.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {result.eventCounts.calendar.checkIns} check-ins, {result.eventCounts.calendar.checkOuts} check-outs
                    </div>
                  </div>
                </div>
              </div>

              {/* Differences Section */}
              <div>
                <h3 
                  className="font-semibold mb-2 flex justify-between items-center cursor-pointer hover:text-blue-600"
                  onClick={() => toggleSection('differences')}
                >
                  <span>Differences</span>
                  <span className="text-xs text-muted-foreground">{expandedSection === 'differences' ? 'Hide' : 'Show'}</span>
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`border rounded-md p-3 ${result.differences.missingFromCalendar > 0 ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="text-sm font-medium mb-1">Missing from Calendar</div>
                    <div className="text-2xl font-bold">{result.differences.missingFromCalendar}</div>
                  </div>
                  <div className={`border rounded-md p-3 ${result.differences.extraInCalendar > 0 ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                    <div className="text-sm font-medium mb-1">Extra in Calendar</div>
                    <div className="text-2xl font-bold">{result.differences.extraInCalendar}</div>
                  </div>
                </div>

                {expandedSection === 'differences' && (
                  <div className="mt-4 space-y-3">
                    {result.differences.listingsMissingEvents.length > 0 && (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Listings with Missing Events</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.differences.listingsMissingEvents.map((listing, index) => (
                            <Badge key={index} variant="outline">{listing}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.samples.missingFromCalendar.length > 0 && (
                      <div className="bg-red-50 p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Sample Missing Events</h4>
                        <div className="text-xs space-y-2">
                          {result.samples.missingFromCalendar.map((event, index) => (
                            <div key={index} className="p-2 bg-white rounded border border-red-200">
                              <div><span className="font-semibold">ID:</span> {event.id}</div>
                              <div><span className="font-semibold">Title:</span> {event.title}</div>
                              <div><span className="font-semibold">Listing:</span> {event.listing}</div>
                              <div><span className="font-semibold">Date:</span> {event.start} to {event.end}</div>
                              <div><span className="font-semibold">Type:</span> {event.isCheckIn ? 'Check-in' : event.isCheckOut ? 'Check-out' : 'Booking'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date Range */}
              <div>
                <h3 className="font-semibold mb-2">Date Range</h3>
                <div className="text-sm">
                  {new Date(result.dateRange.startDate).toLocaleDateString()} to {new Date(result.dateRange.endDate).toLocaleDateString()}
                </div>
              </div>

              {/* Recommendations */}
              {result && result.recommendations && result.recommendations.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold mb-2">Recommendations</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {result.recommendations.map((recommendation: string, index: number) => (
                      <li key={index} className="text-sm">{recommendation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-xs text-muted-foreground">
                Run time: {new Date().toLocaleTimeString()}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.href = '/dashboard/calendar'}
              >
                Go to Calendar
              </Button>
            </CardFooter>
          </Card>
        )}

        {!result && !isLoading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>Click "Run Validation Test" to check if your calendar is displaying all synced events correctly.</p>
              <p className="text-sm mt-2">This will compare events in the database with events shown in the calendar.</p>
            </CardContent>
          </Card>
        )}

        {result && result.imbalancedListings && result.imbalancedListings.length > 0 && (
          <div>
            <h3 
              className="font-semibold mb-2 flex justify-between items-center cursor-pointer hover:text-blue-600"
              onClick={() => toggleSection('imbalanced')}
            >
              <span>Imbalanced Check-ins/Check-outs</span>
              <span className="text-xs text-muted-foreground">{expandedSection === 'imbalanced' ? 'Hide' : 'Show'}</span>
            </h3>
            <div className="border border-orange-200 bg-orange-50 rounded-md p-3">
              <div className="text-sm font-medium mb-1">Listings with Imbalanced Events</div>
              <div className="text-sm">{result.imbalancedListings.length} listings have different numbers of check-ins and check-outs</div>
            </div>

            {expandedSection === 'imbalanced' && (
              <div className="mt-4 space-y-3">
                <div className="bg-orange-50 p-3 rounded-md">
                  <h4 className="text-sm font-medium mb-2">Imbalanced Listings</h4>
                  <div className="text-xs space-y-2">
                    {result.imbalancedListings.map((item, index) => (
                      <div key={index} className="p-2 bg-white rounded border border-orange-200">
                        <div><span className="font-semibold">Listing:</span> {item.listing}</div>
                        <div><span className="font-semibold">Check-ins:</span> {item.checkIns}</div>
                        <div><span className="font-semibold">Check-outs:</span> {item.checkOuts}</div>
                        <div><span className="font-semibold">Difference:</span> {item.difference}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {result && result.icalSources && (
          <div>
            <h3 
              className="font-semibold mb-2 flex justify-between items-center cursor-pointer hover:text-blue-600"
              onClick={() => toggleSection('ical')}
            >
              <span>iCal Comparison</span>
              <span className="text-xs text-muted-foreground">{expandedSection === 'ical' ? 'Hide' : 'Show'}</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className={`border rounded-md p-3 ${result.differences.missingFromDb && result.differences.missingFromDb > 0 ? 'border-blue-200 bg-blue-50' : ''}`}>
                <div className="text-sm font-medium mb-1">Events in iCal, Missing from DB</div>
                <div className="text-2xl font-bold">{result.differences.missingFromDb || 0}</div>
              </div>
              <div className={`border rounded-md p-3 ${result.differences.extraInDb && result.differences.extraInDb > 0 ? 'border-blue-200 bg-blue-50' : ''}`}>
                <div className="text-sm font-medium mb-1">Events in DB, Not in iCal</div>
                <div className="text-2xl font-bold">{result.differences.extraInDb || 0}</div>
              </div>
            </div>
            
            {expandedSection === 'ical' && (
              <div className="mt-4 space-y-3">
                <div className="bg-blue-50 p-3 rounded-md">
                  <h4 className="text-sm font-medium mb-2">iCal Sources ({result.icalSources.feedsProcessed} feeds)</h4>
                  <div className="text-xs space-y-2">
                    {result.icalSources.sources.map((source, index) => (
                      <div key={index} className="p-2 bg-white rounded border border-blue-200">
                        <div><span className="font-semibold">Listing:</span> {source.listing}</div>
                        <div><span className="font-semibold">Feed:</span> {source.feedName}</div>
                        <div><span className="font-semibold">Events:</span> {source.eventsCount}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {result.samples.missingFromDb && result.samples.missingFromDb.length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Sample Events Missing from DB</h4>
                    <div className="text-xs space-y-2">
                      {result.samples.missingFromDb.map((event, index) => (
                        <div key={index} className="p-2 bg-white rounded border border-blue-200">
                          <div><span className="font-semibold">ID:</span> {event.id}</div>
                          <div><span className="font-semibold">Title:</span> {event.title}</div>
                          <div><span className="font-semibold">Listing:</span> {event.listing}</div>
                          <div><span className="font-semibold">Date:</span> {event.start} to {event.end}</div>
                          <div><span className="font-semibold">Type:</span> {event.isCheckIn ? 'Check-in' : event.isCheckOut ? 'Check-out' : 'Booking'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SyncTestPage() {
  return (
    <ProtectedRoute adminOnly={true}>
      <SyncTestContent />
    </ProtectedRoute>
  );
} 