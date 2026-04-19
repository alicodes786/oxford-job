import { format } from 'date-fns';
import type { BinCollectionItem, BinScheduleType } from '@/lib/models';

const DAY_LOWER_TO_PROPER: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Normalize weekday to English title case (Monday … Sunday). */
export function normalizeWeekday(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return 'Monday';
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (DAY_LOWER_TO_PROPER[lower]) return DAY_LOWER_TO_PROPER[lower];
  if (t.length < 2) return 'Monday';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Parse yyyy-MM-dd as local calendar date (no UTC shift). */
export function parseLocalDateString(yyyyMmDd: string): Date {
  const [y, m, d] = yyyyMmDd.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function formatLocalWeekday(yyyyMmDd: string): string {
  const d = parseLocalDateString(yyyyMmDd);
  if (Number.isNaN(d.getTime())) return '';
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}

/** Days from `from` to `to` (local calendar dates, yyyy-MM-dd). */
export function diffLocalCalendarDays(fromYyyyMmDd: string, toYyyyMmDd: string): number {
  const a = parseLocalDateString(fromYyyyMmDd);
  const b = parseLocalDateString(toYyyyMmDd);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Most recent local calendar date on or before `ref` that falls on `weekdayName`
 * (same idea as anchoring a fortnightly series to a known collection week).
 */
export function mostRecentLocalDateForWeekday(weekdayName: string, ref: Date = new Date()): string {
  const want = normalizeWeekday(weekdayName);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetIdx = days.indexOf(want);
  if (targetIdx < 0) return format(ref, 'yyyy-MM-dd');
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const cur = d.getDay();
  const diff = (cur - targetIdx + 7) % 7;
  d.setDate(d.getDate() - diff);
  return format(d, 'yyyy-MM-dd');
}

function parseAnchor(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

export function normalizeBinItem(raw: Partial<BinCollectionItem> & Record<string, unknown>): BinCollectionItem {
  const rawSchedule = (raw.schedule_type as string | undefined) ?? 'weekly';
  const dayNorm = normalizeWeekday(typeof raw.day === 'string' ? raw.day : 'Monday');

  // Legacy: one_off → weekly, weekday taken from one_off_date if possible
  if (rawSchedule === 'one_off') {
    const legacy = typeof raw.one_off_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.one_off_date);
    const wd = legacy ? formatLocalWeekday(raw.one_off_date as string) : dayNorm;
    return {
      type: typeof raw.type === 'string' ? raw.type : '',
      reminder_enabled: Boolean(raw.reminder_enabled),
      schedule_type: 'weekly',
      day: wd || dayNorm,
      anchor_date: null,
    };
  }

  let schedule: BinScheduleType = 'weekly';
  if (rawSchedule === 'fortnightly') schedule = 'fortnightly';

  let anchor = parseAnchor(raw.anchor_date);
  if (schedule === 'fortnightly') {
    if (!anchor) {
      anchor = mostRecentLocalDateForWeekday(dayNorm);
    } else {
      // Ensure anchor weekday matches collection day (snap to same week's occurrence)
      const aw = formatLocalWeekday(anchor);
      if (aw && aw !== dayNorm) {
        anchor = mostRecentLocalDateForWeekday(dayNorm, parseLocalDateString(anchor));
      }
    }
  } else {
    anchor = null;
  }

  return {
    type: typeof raw.type === 'string' ? raw.type : '',
    reminder_enabled: Boolean(raw.reminder_enabled),
    schedule_type: schedule,
    day: dayNorm,
    anchor_date: schedule === 'fortnightly' ? anchor : null,
  };
}

export function normalizeBinCollectionArray(raw: unknown): BinCollectionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeBinItem(item as Partial<BinCollectionItem>));
}

/** One weekly row from legacy listings.bin_collection_day (e.g. "monday"). */
export function legacyDayToBinItem(day: string | null | undefined): BinCollectionItem | null {
  if (!day || typeof day !== 'string' || !day.trim()) return null;
  return {
    type: 'Blue',
    reminder_enabled: true,
    schedule_type: 'weekly',
    day: normalizeWeekday(day),
    anchor_date: null,
  };
}

/** Whether a schedule row includes this local calendar day as a collection day. */
export function itemMatchesLocalDate(item: BinCollectionItem, yyyyMmDd: string): boolean {
  const weekday = formatLocalWeekday(yyyyMmDd);
  if (!weekday || weekday !== normalizeWeekday(item.day)) return false;

  const schedule = item.schedule_type ?? 'weekly';
  if (schedule === 'weekly') return true;

  if (schedule === 'fortnightly') {
    const anchor = item.anchor_date;
    if (!anchor || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return false;
    const diff = diffLocalCalendarDays(anchor, yyyyMmDd);
    if (Number.isNaN(diff) || diff < 0) return false;
    return diff % 14 === 0;
  }

  return false;
}

export interface BinAlertRow {
  id: string;
  listing_id: string;
  listing_name: string;
  waste_type: string;
  collection_date: string;
  schedule_label: string;
}

/** Build reminder rows for a target local date (e.g. tomorrow for “day before” alerts). */
export function buildBinAlertsForDate(
  entries: Array<{ listing_id: string; listing_name: string; items: BinCollectionItem[] }>,
  targetDateYyyyMmDd: string
): BinAlertRow[] {
  const out: BinAlertRow[] = [];
  for (const entry of entries) {
    entry.items.forEach((item, index) => {
      if (!item.reminder_enabled) return;
      if (!itemMatchesLocalDate(item, targetDateYyyyMmDd)) return;
      const schedule = item.schedule_type ?? 'weekly';
      const scheduleLabel =
        schedule === 'fortnightly'
          ? `Fortnightly (${normalizeWeekday(item.day)})`
          : `Weekly (${normalizeWeekday(item.day)})`;
      out.push({
        id: `${entry.listing_id}-${index}-${item.type}-${targetDateYyyyMmDd}`,
        listing_id: entry.listing_id,
        listing_name: entry.listing_name,
        waste_type: item.type || 'Bins',
        collection_date: targetDateYyyyMmDd,
        schedule_label: scheduleLabel,
      });
    });
  }
  return out;
}
