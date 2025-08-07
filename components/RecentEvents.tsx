'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarIcon, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RecentEvent {
  id: string;
  uuid: string;
  eventId: string;
  title: string;
  start: string;
  end: string;
  listing: string;
  listingName: string;
  checkoutType?: 'same_day' | 'open';
  checkoutTime?: string;
  cleaner?: {
    id: string;
    name: string;
    hourlyRate: number;
    hours: number;
  };
  eventType?: string;
  listingHours?: number;
  createdAt: string;
  mostRecentActivity: string;  // Add this field
  isActive: boolean;
  isCancelled: boolean;
}

interface RecentEventsProps {
  listingName?: string;
  limit?: number;
}

export default function RecentEvents({ listingName, limit = 20 }: RecentEventsProps) {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentEvents();
  }, [listingName, limit]);

  const fetchRecentEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (listingName) params.append('listingName', listingName);
      params.append('limit', limit.toString()); // Use the limit prop instead of hardcoding 5
      
      const response = await fetch(`/api/recent-events?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events);
      } else {
        setError(data.error || 'Failed to fetch recent events');
      }
    } catch (error) {
      console.error('Error fetching recent events:', error);
      setError('Failed to fetch recent events');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-white">
            <CardContent className="p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-3">
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-center text-gray-500">
          No recent events found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map(event => (
        <Card 
          key={event.id} 
          className={cn(
            "bg-white hover:bg-gray-50 transition-colors",
            "border-l-[3px]",
            event.isActive 
              ? event.checkoutType === 'same_day'
                ? "border-l-orange-400"
                : "border-l-blue-400"
              : "border-l-red-400"
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              {/* Left side - Main info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {event.listingName}
                  </span>
                  <Badge 
                    variant={event.checkoutType === 'same_day' ? 'secondary' : 'default'}
                    className={cn(
                      "text-[10px] px-1 py-0",
                      event.checkoutType === 'same_day' && "bg-orange-100 text-orange-700 hover:bg-orange-100"
                    )}
                  >
                    {event.checkoutType === 'same_day' ? 'Same Day' : 'Open'}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1 py-0",
                      !event.isActive && "border-red-200 text-red-700",
                      event.isActive && event.checkoutType === 'same_day' && "border-orange-200 text-orange-700",
                      event.isActive && event.checkoutType === 'open' && "border-blue-200 text-blue-700"
                    )}
                  >
                    {!event.isActive ? 'Cancelled' : 'Active'}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>
                      {format(new Date(event.start), 'MMM d')} - {format(new Date(event.end), 'MMM d')}
                    </span>
                  </div>
                  
                  {event.cleaner && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{event.cleaner.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right side - Timestamp */}
              <div className="text-[10px] text-gray-500 whitespace-nowrap">
                {formatDistanceToNow(new Date(event.mostRecentActivity))} ago
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 