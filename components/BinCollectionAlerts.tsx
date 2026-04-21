'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Recycle } from 'lucide-react';
import type { BinAlertRow } from '@/lib/bin-collection-schedule';
import { format, parseISO } from 'date-fns';

interface BinCollectionAlertsProps {
  alerts: BinAlertRow[];
  isMobile?: boolean;
}

function formatCollectionDay(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'EEE, MMM d');
  } catch {
    return dateStr;
  }
}

export function BinCollectionAlerts({ alerts, isMobile = false }: BinCollectionAlertsProps) {
  if (alerts.length === 0) return null;

  if (isMobile) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-slate-200 border-l-4 border-l-slate-600 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <Recycle className="h-4 w-4 text-slate-700" />
            <span className="text-sm font-semibold text-slate-900">Bin collection</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-800">
            {alerts.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.listing_name}</span>
                <span className="text-slate-600">
                  {' '}
                  · {a.waste_type} · {formatCollectionDay(a.collection_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Alert className="border-slate-200 border-l-4 border-l-slate-600 bg-slate-50 shadow-sm">
        <Recycle className="h-5 w-5 text-slate-700" />
        <AlertTitle className="text-slate-900">Bin collection reminders</AlertTitle>
        <AlertDescription className="mt-2 text-sm text-slate-800">
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                <span className="font-medium">{a.listing_name}</span>
                <span className="text-slate-600">
                  {a.waste_type} · {formatCollectionDay(a.collection_date)}
                </span>
                <span className="text-xs text-slate-500">{a.schedule_label}</span>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
