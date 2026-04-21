'use client';

import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Parse HH:mm (24h) to 12h parts; null if empty/invalid */
export function time24ToParts(
  time24: string
): { h: string; m: string; ap: 'AM' | 'PM' } | null {
  if (!time24?.trim()) return null;
  const [hs, rawM] = time24.trim().split(':');
  const hour = parseInt(hs, 10);
  const minute = Math.min(59, Math.max(0, parseInt(rawM ?? '0', 10)));
  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || !Number.isFinite(minute)) {
    return null;
  }
  const ap = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return { h: String(hour12), m: String(minute).padStart(2, '0'), ap };
}

export function partsToTime24(h: string, m: string, ap: 'AM' | 'PM'): string {
  let hour = parseInt(h, 10);
  const minute = parseInt(m, 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '00:00';
  const mi = Math.min(59, Math.max(0, minute));
  if (ap === 'PM' && hour !== 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

const DEFAULT_PARTS = { h: '12', m: '00', ap: 'AM' as const };

export interface EarlyCheckinRequestedTimeDropdownsProps {
  label: string;
  /** HH:mm (24h) or empty */
  value: string;
  onChange: (next: string) => void;
  allowEmpty?: boolean;
  idPrefix?: string;
  className?: string;
}

/**
 * Hour / minute / AM–PM dropdowns (no native time input) for mobile-friendly entry.
 * Value round-trips as HH:mm for the API.
 */
export function EarlyCheckinRequestedTimeDropdowns({
  label,
  value,
  onChange,
  allowEmpty = true,
  idPrefix = 'requested-time',
  className,
}: EarlyCheckinRequestedTimeDropdownsProps) {
  const [local, setLocal] = useState<{ h: string; m: string; ap: 'AM' | 'PM' } | null>(() =>
    time24ToParts(value)
  );

  useEffect(() => {
    setLocal(time24ToParts(value));
  }, [value]);

  const merged = useMemo(() => local ?? DEFAULT_PARTS, [local]);

  const applyFromParts = (next: { h: string; m: string; ap: 'AM' | 'PM' }) => {
    setLocal(next);
    onChange(partsToTime24(next.h, next.m, next.ap));
  };

  const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);

  const minuteOptions = useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')),
    []
  );

  const allEmpty = allowEmpty && !value?.trim();

  const hourValue = allEmpty ? '__empty__' : merged.h;
  const minuteValue = allEmpty ? '__empty__' : merged.m;
  const apValue = allEmpty ? '__empty__' : merged.ap;

  return (
    <div className={cn('grid gap-2', className)}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={hourValue}
          onValueChange={(v) => {
            if (v === '__empty__') {
              setLocal(null);
              onChange('');
              return;
            }
            const base = time24ToParts(value) ?? DEFAULT_PARTS;
            applyFromParts({ ...base, h: v });
          }}
        >
          <SelectTrigger id={`${idPrefix}-hour`} className="w-full">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            {allowEmpty && <SelectItem value="__empty__">—</SelectItem>}
            {hourOptions.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={minuteValue}
          onValueChange={(v) => {
            if (v === '__empty__') {
              setLocal(null);
              onChange('');
              return;
            }
            const base = time24ToParts(value) ?? DEFAULT_PARTS;
            applyFromParts({ ...base, m: v });
          }}
        >
          <SelectTrigger id={`${idPrefix}-minute`} className="w-full">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent className="max-h-[240px]">
            {allowEmpty && <SelectItem value="__empty__">—</SelectItem>}
            {minuteOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={apValue}
          onValueChange={(v) => {
            if (v === '__empty__') {
              setLocal(null);
              onChange('');
              return;
            }
            const base = time24ToParts(value) ?? DEFAULT_PARTS;
            applyFromParts({ ...base, ap: v as 'AM' | 'PM' });
          }}
        >
          <SelectTrigger id={`${idPrefix}-ap`} className="w-full">
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            {allowEmpty && <SelectItem value="__empty__">—</SelectItem>}
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
