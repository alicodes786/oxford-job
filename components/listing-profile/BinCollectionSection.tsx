'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Recycle } from 'lucide-react';
import type { BinCollectionItem, BinScheduleType } from '@/lib/models';
import { normalizeWeekday } from '@/lib/bin-collection-schedule';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** Local copy — avoids a rare client-bundle issue where a named export from `bin-collection-schedule` was undefined at runtime. */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Most recent local calendar date on or before `ref` that falls on `weekdayName` (matches `lib/bin-collection-schedule`). */
function mostRecentLocalDateForWeekday(weekdayName: string, ref: Date = new Date()): string {
  const want = normalizeWeekday(weekdayName);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIdx = dayNames.indexOf(want);
  if (targetIdx < 0) return toYmd(ref);
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const cur = d.getDay();
  const diff = (cur - targetIdx + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toYmd(d);
}

const WASTE_TYPES = ['Blue', 'Grey (Black)', 'Green', 'Brown'] as const;

function defaultRow(): BinCollectionItem {
  return {
    type: 'Blue',
    reminder_enabled: true,
    schedule_type: 'weekly',
    day: 'Monday',
    anchor_date: null,
  };
}

interface BinCollectionSectionProps {
  items: BinCollectionItem[];
  onItemsChange: (items: BinCollectionItem[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export function BinCollectionSection({ items, onItemsChange, notes, onNotesChange }: BinCollectionSectionProps) {
  /** Include legacy saved types so the Select always has a matching option. */
  const binTypeOptions = useMemo(() => {
    const s = new Set<string>(WASTE_TYPES);
    for (const it of items) {
      if (it.type?.trim()) s.add(it.type.trim());
    }
    return [...s];
  }, [items]);

  const addRow = () => {
    onItemsChange([...items, defaultRow()]);
  };

  const removeRow = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, patch: Partial<BinCollectionItem>) => {
    const next = [...items];
    const cur = next[index];
    if (!cur) return;
    const merged: BinCollectionItem = { ...cur, ...patch };
    const schedule = (merged.schedule_type ?? 'weekly') as BinScheduleType;

    merged.day = normalizeWeekday(merged.day || 'Monday');

    if (schedule === 'weekly') {
      merged.schedule_type = 'weekly';
      merged.anchor_date = null;
    } else {
      merged.schedule_type = 'fortnightly';
      if (patch.anchor_date !== undefined) {
        merged.anchor_date = patch.anchor_date || mostRecentLocalDateForWeekday(merged.day);
      } else if (patch.day !== undefined || patch.schedule_type === 'fortnightly') {
        merged.anchor_date = mostRecentLocalDateForWeekday(merged.day);
      } else if (!merged.anchor_date) {
        merged.anchor_date = mostRecentLocalDateForWeekday(merged.day);
      }
    }

    next[index] = merged;
    onItemsChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Recycle className="h-5 w-5 mr-2" />
          Bin collection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Add each bin stream and whether collection is weekly or every two weeks (fortnightly). For fortnightly, pick a
          reference date on the same weekday, reminders use a 14-day cycle from that date, like recurring manual
          events. Enable reminders to show a banner on the calendar the day before collection.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No schedules yet. Add a row for each collection type.</p>
          )}
          {items.map((row, index) => {
            const schedule: BinScheduleType = row.schedule_type ?? 'weekly';
            return (
              <div key={index} className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Bin type</Label>
                    <Select value={row.type || ''} onValueChange={(v) => updateRow(index, { type: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {binTypeOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Schedule</Label>
                    <Select
                      value={schedule}
                      onValueChange={(v) => updateRow(index, { schedule_type: v as BinScheduleType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly (every 2 weeks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Collection weekday</Label>
                  <Select value={normalizeWeekday(row.day)} onValueChange={(v) => updateRow(index, { day: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {schedule === 'fortnightly' && (
                  <div className="space-y-1.5">
                    <Label>Reference collection date</Label>
                    <Input
                      type="date"
                      value={row.anchor_date || ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        updateRow(index, { anchor_date: v });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      A date when this bin was (or will be) collected on the weekday above. Fortnightly repeats every 14
                      days from this date.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.reminder_enabled}
                      onCheckedChange={(checked) => updateRow(index, { reminder_enabled: checked })}
                    />
                    <span className="text-sm">Calendar reminder (day before)</span>
                    {row.reminder_enabled && (
                      <Badge variant="secondary" className="text-xs">
                        On
                      </Badge>
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add collection
        </Button>

        <div className="space-y-1.5">
          <Label htmlFor="bin_collection_notes">Additional notes</Label>
          <Textarea
            id="bin_collection_notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="e.g. bring bins to front, bank holiday changes, etc."
            className="min-h-20"
          />
        </div>
      </CardContent>
    </Card>
  );
}
