'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarIcon, User, Clock, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface JobCompletionNotification {
  id: string;
  assignment_uuid: string;
  cleaner_uuid: string;
  cleaner_name: string;
  listing_name: string;
  completion_date: string;
  cleanliness_rating: number;
  damage_question: 'Yes' | 'No' | 'Maybe';
  duration_minutes: number;
  created_at: string;
  is_read: boolean;
}

interface JobCompletionNotificationsProps {
  limit?: number;
}

export default function JobCompletionNotifications({ limit = 20 }: JobCompletionNotificationsProps) {
  const [notifications, setNotifications] = useState<JobCompletionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, [limit]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      
      const response = await fetch(`/api/job-notifications?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
      } else {
        setError(data.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/job-notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, is_read: true }
              : notif
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
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

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-center text-gray-500">
          No new job completion reports
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map(notification => (
        <Card 
          key={notification.id} 
          className={cn(
            "bg-white hover:bg-gray-50 transition-colors cursor-pointer",
            "border-l-[3px]",
            notification.is_read 
              ? "border-l-gray-300"
              : "border-l-blue-400",
            notification.damage_question === 'Yes' && "border-l-red-400",
            notification.damage_question === 'Maybe' && "border-l-orange-400"
          )}
          onClick={() => !notification.is_read && markAsRead(notification.id)}
        >
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              {/* Left side - Main info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">
                    {notification.listing_name}
                  </span>
                  <Badge 
                    variant={notification.damage_question === 'Yes' ? 'destructive' : 'default'}
                    className={cn(
                      "text-[10px] px-1 py-0",
                      notification.damage_question === 'Maybe' && "bg-orange-100 text-orange-700 hover:bg-orange-100"
                    )}
                  >
                    {notification.damage_question === 'Yes' ? 'Damage Reported' :
                     notification.damage_question === 'Maybe' ? 'Possible Damage' : 'No Damage'}
                  </Badge>
                  {!notification.is_read && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1 py-0">
                      New
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{notification.cleaner_name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>
                      {format(new Date(notification.completion_date), 'MMM d, yyyy')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{notification.duration_minutes} minutes</span>
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{notification.cleanliness_rating}/5</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cleanliness Rating</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Right side - Timestamp */}
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 