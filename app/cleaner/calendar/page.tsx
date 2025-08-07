'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfDay, endOfDay, isSameDay, formatDistanceToNow, parse, isValid } from 'date-fns';
import { ChevronDown, ChevronUp, Loader2, CalendarDays, Home, RefreshCw, Clock, AlertCircle, Plus } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';
import { getListings } from '@/lib/models';
import { supabase } from '@/lib/supabase';
import { useCleanerAuth, CleanerProtectedRoute } from '@/lib/cleaner-auth';
import UniversalCalendarPage from '@/components/UniversalCalendarPage';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  listing?: string;
  listingName?: string;
  color?: string;
  isCheckIn?: boolean;
  isCheckOut?: boolean;
  isSameDayCheckout?: boolean;
  checkoutTime?: string;
  checkoutType?: 'same_day' | 'open';
  guestName?: string;
  cleaner?: any;
  eventType?: string;
  listingHours?: number;
}

export default function CleanerCalendarPage() {
  return (
    <CleanerProtectedRoute>
      <div className="p-8">
        <CleanerCalendarContent />
      </div>
    </CleanerProtectedRoute>
  );
}

function CleanerCalendarContent() {
  const { cleaner, isLoading } = useCleanerAuth();
  if (isLoading) return null;
  return (
    <UniversalCalendarPage hasAccess={cleaner?.role === 'editor'} noAccessMessage="You do not have permission to view the calendar. Only cleaners with the 'editor' role can access this page." />
  );
} 