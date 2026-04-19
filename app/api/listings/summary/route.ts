import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sortListingsByName } from '@/lib/utils';

// Helper: Monday-Sunday week boundaries (same as payment reports)
function getWeekBoundaries(date: Date) {
  const day = new Date(date);
  const dayOfWeek = day.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(day);
  monday.setDate(day.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// Human-readable label for compliance type
const COMPLIANCE_LABELS: Record<string, string> = {
  gas_cert: 'Gas Certificate',
  eicr: 'EICR',
  pat_test: 'PAT Test',
  insurance: 'Insurance Certificate',
  fire_risk: 'Fire Risk Assessment',
  ownership: 'Ownership/Landlord Agreement',
};

// GET /api/listings/summary?month=11&year=2025
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().getMonth() + 1;
    const year = searchParams.get('year') || new Date().getFullYear();

    const periodMonth = parseInt(month.toString());
    const periodYear = parseInt(year.toString());

    // ── Date helpers ──────────────────────────────────────────────────────────
    const now = new Date();
    const { monday: weekStart, sunday: weekEnd } = getWeekBoundaries(now);

    // Today boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);

    const todayStr = todayStart.toISOString().split('T')[0];

    // Upcoming 14 days window
    const fourteenDaysLater = new Date(now);
    fourteenDaysLater.setDate(now.getDate() + 14);
    const fourteenDaysLaterStr = fourteenDaysLater.toISOString().split('T')[0];

    // Upcoming 90 days window (for certificate expiry)
    const ninetyDaysLater = new Date(now);
    ninetyDaysLater.setDate(now.getDate() + 90);
    const ninetyDaysLaterStr = ninetyDaysLater.toISOString().split('T')[0];

    // Calculate date range for the selected period (monthly)
    const startDate = new Date(periodYear, periodMonth - 1, 1);
    const endDate = new Date(periodYear, periodMonth, 0, 23, 59, 59);

    // ── 1. Get all listings ───────────────────────────────────────────────────
    const { data: allListings, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .order('name');

    if (listingsError) throw listingsError;

    // ── 2. Monthly cleaner assignments ────────────────────────────────────────
    const { data: assignments, error: assignmentsError } = await supabase
      .from('cleaner_assignments')
      .select(`
        *,
        event:event_uuid(
          uuid,
          listing_id,
          listing_name,
          checkout_date,
          listing_hours
        ),
        cleaner:cleaner_uuid(
          id,
          name,
          hourly_rate
        )
      `)
      .gte('event.checkout_date', startDate.toISOString())
      .lte('event.checkout_date', endDate.toISOString());

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    // ── 3. This-week cleaner assignments (per-listing) ────────────────────────
    const { data: weekAssignments, error: weekAssignmentsError } = await supabase
      .from('cleaner_assignments')
      .select(`
        uuid,
        hours,
        event:event_uuid(
          uuid,
          listing_id,
          listing_name,
          checkout_date,
          listing_hours
        )
      `)
      .gte('event.checkout_date', weekStart.toISOString())
      .lte('event.checkout_date', weekEnd.toISOString());

    if (weekAssignmentsError) {
      console.error('Error fetching week assignments:', weekAssignmentsError);
    }

    // ── 4. Today cleaner assignments (per-listing) ────────────────────────────
    const { data: dayAssignments, error: dayAssignmentsError } = await supabase
      .from('cleaner_assignments')
      .select(`
        uuid,
        hours,
        event:event_uuid(
          uuid,
          listing_id,
          listing_name,
          checkout_date,
          listing_hours
        )
      `)
      .gte('event.checkout_date', todayStart.toISOString())
      .lt('event.checkout_date', tomorrowStart.toISOString());

    if (dayAssignmentsError) {
      console.error('Error fetching day assignments:', dayAssignmentsError);
    }

    // ── 5. Active listings count ──────────────────────────────────────────────
    // listings.color IS NOT NULL mirrors active state
    // (toggleListingActive sets color=null on deactivate, restores on activate)
    const { data: activeListingRows, error: activeFeedsError } = await supabase
      .from('listings')
      .select('id')
      .not('color', 'is', null);

    if (activeFeedsError) {
      console.error('Error fetching active listings:', activeFeedsError);
    }
    const activeListingsCount = (activeListingRows || []).length;

    // ── 6. All reminders (compliance / general) ───────────────────────────────
    const { data: allReminders, error: remindersError } = await supabase
      .from('listing_reminders')
      .select('*, listing:listing_id(id, name)')
      .order('due_date', { ascending: true });

    if (remindersError) {
      console.error('Error fetching reminders:', remindersError);
    }

    // ── 7. Certificate expiry reminders (next 90 days + already expired) ─────
    const { data: certDocs, error: certDocsError } = await supabase
      .from('listing_compliance_documents')
      .select(`
        id,
        listing_id,
        compliance_type,
        expiry_date,
        file_name,
        listing:listing_id(id, name)
      `)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', ninetyDaysLaterStr)
      .order('expiry_date', { ascending: true });

    if (certDocsError) {
      console.error('Error fetching certificate docs:', certDocsError);
    }

    // ── 8. Compliance docs map (for reminder enrichment) ──────────────────────
    const { data: complianceDocs, error: complianceDocsError } = await supabase
      .from('listing_compliance_documents')
      .select('id, reminder_id, expiry_date, compliance_type, listing_id');

    if (complianceDocsError) {
      console.error('Error fetching compliance docs:', complianceDocsError);
    }

    const complianceMap = new Map();
    (complianceDocs || []).forEach((doc: any) => {
      if (doc.reminder_id) {
        complianceMap.set(doc.reminder_id, doc);
      }
    });

    // ── 9. Parking permit reminders (upcoming 14 days, outstanding only) ──────
    const { data: parkingReminders, error: parkingError } = await supabase
      .from('parking_permits')
      .select(`
        id,
        listing_id,
        vehicle_registration,
        check_in_date,
        check_out_date,
        parking_days,
        permit_status,
        fee_paid_status,
        notes,
        listing:listings(id, name)
      `)
      .gte('check_in_date', todayStr)
      .lte('check_in_date', fourteenDaysLaterStr)
      .or('permit_status.eq.permit_os,fee_paid_status.eq.payment_pending')
      .order('check_in_date', { ascending: true });

    if (parkingError) {
      console.error('Error fetching parking reminders:', parkingError);
    }

    // ── 10. Early check-in reminders (upcoming 14 days) ───────────────────────
    const { data: earlyCheckinReminders, error: earlyCheckinError } = await supabase
      .from('early_checkins')
      .select(`
        id,
        listing_id,
        booking_platform,
        check_in_date,
        standard_time,
        requested_time,
        fee_paid,
        payment_status,
        notes,
        listing:listings(id, name)
      `)
      .gte('check_in_date', todayStr)
      .lte('check_in_date', fourteenDaysLaterStr)
      .order('check_in_date', { ascending: true });

    if (earlyCheckinError) {
      console.error('Error fetching early checkin reminders:', earlyCheckinError);
    }

    // ── 11. Bin collection reminders (from listing_reminders with bin type) ───
    const { data: binReminders, error: binError } = await supabase
      .from('listing_reminders')
      .select('*, listing:listing_id(id, name)')
      .ilike('reminder_type', '%bin%')
      .neq('status', 'completed')
      .lte('due_date', fourteenDaysLaterStr)
      .order('due_date', { ascending: true });

    if (binError) {
      console.error('Error fetching bin reminders:', binError);
    }

    // ── 12. Maintenance issues (from cleaner checklists) ─────────────────────
    const { data: maintenanceIssues, error: maintenanceError } = await supabase
      .from('job_completions')
      .select(`
        id,
        listing_name,
        missing_items_details,
        damage_question,
        created_at,
        cleaner:cleaner_uuid(id, name)
      `)
      .or('missing_items_details.not.is.null,damage_question.eq.Yes')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (maintenanceError) {
      console.error('Error fetching maintenance issues:', maintenanceError);
    }

    // Filter to only real issues
    const filteredIssues = (maintenanceIssues || []).filter((issue: any) =>
      (issue.missing_items_details && issue.missing_items_details.trim() !== '') ||
      issue.damage_question === 'Yes'
    );

    // ── 13. Property Key Data — today's checkouts + access codes ─────────────
    // Step 1: Get today's checkout events
    const { data: todayCheckouts, error: checkoutsError } = await supabase
      .from('events')
      .select('uuid, listing_name, checkout_date')
      .gte('checkout_date', todayStart.toISOString())
      .lt('checkout_date', tomorrowStart.toISOString())
      .eq('is_active', true);

    if (checkoutsError) {
      console.error('Error fetching today checkouts:', checkoutsError);
    }

    let propertyKeyData: any[] = [];

    if (todayCheckouts && todayCheckouts.length > 0) {
      // Step 2: Get unique listing names and fetch listing details
      const uniqueListingNames = [...new Set(todayCheckouts.map((e: any) => e.listing_name).filter(Boolean))];

      const { data: checkoutListings, error: checkoutListingsError } = await supabase
        .from('listings')
        .select('id, name, address_line1, address_line2, city, postcode, county, access_code, lock_type, access_instructions')
        .in('name', uniqueListingNames);

      if (checkoutListingsError) {
        console.error('Error fetching checkout listings:', checkoutListingsError);
      }

      // Step 3: Get listing_operations for those listings
      const checkoutListingIds = (checkoutListings || []).map((l: any) => l.id);
      let operationsMap: Record<string, any> = {};

      if (checkoutListingIds.length > 0) {
        const { data: ops, error: opsError } = await supabase
          .from('listing_operations')
          .select('listing_id, key_safe_code, spare_key_location, parking_access_code, gate_code')
          .in('listing_id', checkoutListingIds);

        if (opsError) {
          console.error('Error fetching listing operations:', opsError);
        }

        (ops || []).forEach((op: any) => {
          operationsMap[op.listing_id] = op;
        });
      }

      // Step 4: Combine and deduplicate by listing_name
      const seenNames = new Set<string>();
      propertyKeyData = (checkoutListings || [])
        .filter((listing: any) => {
          if (seenNames.has(listing.name)) return false;
          seenNames.add(listing.name);
          return true;
        })
        .map((listing: any) => {
          const ops = operationsMap[listing.id] || {};
          const addressParts = [
            listing.address_line1,
            listing.address_line2,
            listing.city,
            listing.county,
            listing.postcode,
          ].filter(Boolean);

          return {
            listing_id: listing.id,
            listing_name: listing.name,
            address: addressParts.join(', ') || null,
            lock_type: listing.lock_type || null,
            access_code: listing.access_code || null,
            access_instructions: listing.access_instructions || null,
            key_safe_code: ops.key_safe_code || null,
            spare_key_location: ops.spare_key_location || null,
            parking_access_code: ops.parking_access_code || null,
            gate_code: ops.gate_code || null,
          };
        })
        // Sort by listing name using same ordering as the rest of the app
        // sortListingsByName needs a { name } shape — map listing_name → name for sorting
        .sort((a, b) => sortListingsByName({ name: a.listing_name }, { name: b.listing_name }));
    }

    // ── 14. Process listing stats (monthly) ──────────────────────────────────
    // NOTE: cleanings_count & total_hours include all assignments in the period
    // (past AND future), but last_cleaning only records past/today dates so we
    // never show a future date in the "Last Clean" column.
    const listingStats = new Map<string, {
      listing_id: string;
      listing_name: string;
      cleanings_count: number;
      total_hours: number;
      last_cleaning: string | null;
    }>();

    (assignments || []).forEach((assignment: any) => {
      if (!assignment.event) return;
      const listingId = assignment.event.listing_id;
      const listingName = assignment.event.listing_name;
      if (!listingId) return;

      const stats = listingStats.get(listingId) || {
        listing_id: listingId,
        listing_name: listingName,
        cleanings_count: 0,
        total_hours: 0,
        last_cleaning: null,
      };

      stats.cleanings_count++;
      stats.total_hours += parseFloat(assignment.event.listing_hours) || assignment.hours || 0;

      // Only track as "last clean" if the checkout is today or in the past
      // Use string comparison on YYYY-MM-DD to avoid timezone/midnight boundary bugs
      const checkoutDateStr = String(assignment.event.checkout_date).split('T')[0];
      if (checkoutDateStr <= todayStr) {
        if (!stats.last_cleaning || assignment.event.checkout_date > stats.last_cleaning) {
          stats.last_cleaning = assignment.event.checkout_date;
        }
      }

      listingStats.set(listingId, stats);
    });

    // ── 15. Process listing stats (this week) ────────────────────────────────
    const listingWeekStats = new Map<string, {
      listing_id: string;
      listing_name: string;
      cleanings_count: number;
      total_hours: number;
      last_cleaning: string | null;
    }>();

    (weekAssignments || []).forEach((assignment: any) => {
      if (!assignment.event) return;
      const listingId = assignment.event.listing_id;
      const listingName = assignment.event.listing_name;
      if (!listingId) return;

      const stats = listingWeekStats.get(listingId) || {
        listing_id: listingId,
        listing_name: listingName,
        cleanings_count: 0,
        total_hours: 0,
        last_cleaning: null,
      };

      stats.cleanings_count++;
      stats.total_hours += parseFloat(assignment.event.listing_hours) || assignment.hours || 0;

      // Only track as "last clean" if the checkout is today or in the past
      // Use string comparison on YYYY-MM-DD to avoid timezone/midnight boundary bugs
      const checkoutDateStr = String(assignment.event.checkout_date).split('T')[0];
      if (checkoutDateStr <= todayStr) {
        if (!stats.last_cleaning || assignment.event.checkout_date > stats.last_cleaning) {
          stats.last_cleaning = assignment.event.checkout_date;
        }
      }

      listingWeekStats.set(listingId, stats);
    });

    // ── 16. Process listing stats (today) ────────────────────────────────────
    const listingDayStats = new Map<string, {
      listing_id: string;
      listing_name: string;
      cleanings_count: number;
      total_hours: number;
      last_cleaning: string | null;
    }>();

    (dayAssignments || []).forEach((assignment: any) => {
      if (!assignment.event) return;
      const listingId = assignment.event.listing_id;
      const listingName = assignment.event.listing_name;
      if (!listingId) return;

      const stats = listingDayStats.get(listingId) || {
        listing_id: listingId,
        listing_name: listingName,
        cleanings_count: 0,
        total_hours: 0,
        last_cleaning: null,
      };

      stats.cleanings_count++;
      stats.total_hours += parseFloat(assignment.event.listing_hours) || assignment.hours || 0;
      // Day assignments are already scoped to today — always valid for last_cleaning
      if (!stats.last_cleaning || assignment.event.checkout_date > stats.last_cleaning) {
        stats.last_cleaning = assignment.event.checkout_date;
      }

      listingDayStats.set(listingId, stats);
    });

    // ── 17. Process reminders by urgency ─────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueReminders: any[] = [];
    const dueSoonReminders: any[] = [];
    const upcomingReminders: any[] = [];

    (allReminders || []).forEach((reminder: any) => {
      if (reminder.status === 'completed') return;

      const complianceDoc = complianceMap.get(reminder.id);
      const dateToCheck = complianceDoc?.expiry_date || reminder.due_date;
      const targetDate = new Date(dateToCheck);
      targetDate.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const reminderItem = {
        ...reminder,
        days_until_due: daysUntilDue,
        listing_name: reminder.listing?.name || 'Unknown',
        compliance_document: complianceDoc || null,
      };

      if (daysUntilDue < 0) {
        overdueReminders.push(reminderItem);
      } else if (daysUntilDue <= 7) {
        dueSoonReminders.push(reminderItem);
      } else if (daysUntilDue <= 30) {
        upcomingReminders.push(reminderItem);
      }
    });

    // ── 18. Format certificate expiry reminders ───────────────────────────────
    const formattedCertReminders = (certDocs || []).map((doc: any) => {
      const expiryDate = new Date(doc.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: doc.id,
        listing_id: doc.listing_id,
        listing_name: (doc.listing as any)?.name || 'Unknown',
        compliance_type: doc.compliance_type,
        compliance_label: COMPLIANCE_LABELS[doc.compliance_type] || doc.compliance_type,
        expiry_date: doc.expiry_date,
        days_until_expiry: daysUntilExpiry,
      };
    });

    // ── 19. Format maintenance issues ─────────────────────────────────────────
    const formattedIssues = filteredIssues.map((issue: any) => ({
      id: issue.id,
      listing_name: issue.listing_name,
      issue: issue.missing_items_details || (issue.damage_question === 'Yes' ? 'Damage reported' : ''),
      damage_reported: issue.damage_question === 'Yes',
      reported_at: issue.created_at,
      cleaner_name: issue.cleaner?.name || 'Unknown',
    }));

    // ── 20. Format ops reminders ──────────────────────────────────────────────
    const formattedParkingReminders = (parkingReminders || []).map((p: any) => ({
      id: p.id,
      listing_name: (p.listing as any)?.name || 'Unknown',
      listing_id: p.listing_id,
      check_in_date: p.check_in_date,
      vehicle_registration: p.vehicle_registration,
      permit_status: p.permit_status,
      fee_paid_status: p.fee_paid_status,
      notes: p.notes,
      type: 'parking',
    }));

    const formattedEarlyCheckinReminders = (earlyCheckinReminders || []).map((ec: any) => ({
      id: ec.id,
      listing_name: (ec.listing as any)?.name || 'Unknown',
      listing_id: ec.listing_id,
      check_in_date: ec.check_in_date,
      requested_time: ec.requested_time,
      standard_time: ec.standard_time,
      booking_platform: ec.booking_platform,
      payment_status: ec.payment_status,
      fee_paid: ec.fee_paid,
      notes: ec.notes,
      type: 'early_checkin',
    }));

    const formattedBinReminders = (binReminders || []).map((b: any) => ({
      id: b.id,
      listing_name: b.listing?.name || 'Unknown',
      listing_id: b.listing_id,
      due_date: b.due_date,
      title: b.title,
      notes: b.notes,
      type: 'bin_collection',
    }));

    // ── 21. Totals ────────────────────────────────────────────────────────────
    const totalCleanings = Array.from(listingStats.values()).reduce(
      (sum, stat) => sum + stat.cleanings_count,
      0
    );
    const cleansThisWeek = Array.from(listingWeekStats.values()).reduce(
      (sum, stat) => sum + stat.cleanings_count,
      0
    );
    const cleansToday = Array.from(listingDayStats.values()).reduce(
      (sum, stat) => sum + stat.cleanings_count,
      0
    );
    const totalComplianceReminders = overdueReminders.length + dueSoonReminders.length;
    const certAlertCount = formattedCertReminders.filter(
      (c) => c.days_until_expiry <= 30
    ).length;
    const opsRemindersCount =
      formattedParkingReminders.length +
      formattedEarlyCheckinReminders.length +
      formattedBinReminders.length +
      certAlertCount;

    // ── 22. Build listing_activity arrays (all three periods) ────────────────
    //        Every listing appears in every array — 0 for those with no cleans.
    //        Sorted by sortListingsByName (consistent with calendar / dropdowns).

    const listingActivity = (allListings || [])
      .map((listing: any) => {
        const stats = listingStats.get(listing.id) || {
          listing_id: listing.id,
          listing_name: listing.name,
          cleanings_count: 0,
          total_hours: 0,
          last_cleaning: null,
        };
        return {
          ...listing,
          cleanings_this_period: stats.cleanings_count,
          hours_this_period: stats.total_hours,
          last_cleaning_date: stats.last_cleaning,
          // keep old field names so existing card renders don't break
          cleanings_this_month: stats.cleanings_count,
          hours_this_month: stats.total_hours,
        };
      })
      .sort(sortListingsByName);

    const listingActivityWeek = (allListings || [])
      .map((listing: any) => {
        const stats = listingWeekStats.get(listing.id) || {
          listing_id: listing.id,
          listing_name: listing.name,
          cleanings_count: 0,
          total_hours: 0,
          last_cleaning: null,
        };
        return {
          ...listing,
          cleanings_this_period: stats.cleanings_count,
          hours_this_period: stats.total_hours,
          last_cleaning_date: stats.last_cleaning,
          cleanings_this_month: stats.cleanings_count,
          hours_this_month: stats.total_hours,
        };
      })
      .sort(sortListingsByName);

    const listingActivityDay = (allListings || [])
      .map((listing: any) => {
        const stats = listingDayStats.get(listing.id) || {
          listing_id: listing.id,
          listing_name: listing.name,
          cleanings_count: 0,
          total_hours: 0,
          last_cleaning: null,
        };
        return {
          ...listing,
          cleanings_this_period: stats.cleanings_count,
          hours_this_period: stats.total_hours,
          last_cleaning_date: stats.last_cleaning,
          cleanings_this_month: stats.cleanings_count,
          hours_this_month: stats.total_hours,
        };
      })
      .sort(sortListingsByName);

    // ── 23. Return ────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      period: {
        month: periodMonth,
        year: periodYear,
      },
      summary: {
        total_listings: allListings?.length || 0,
        active_listings_count: activeListingsCount,
        total_cleanings_this_month: totalCleanings,
        cleans_this_week: cleansThisWeek,
        cleans_today: cleansToday,
        ops_reminders_count: opsRemindersCount,
        total_reminders: totalComplianceReminders,
        active_issues: formattedIssues.length,
      },
      reminders: {
        overdue: overdueReminders,
        due_soon: dueSoonReminders,
        upcoming: upcomingReminders,
      },
      certificate_expiry_reminders: formattedCertReminders,
      parking_reminders: formattedParkingReminders,
      early_checkin_reminders: formattedEarlyCheckinReminders,
      bin_collection_reminders: formattedBinReminders,
      maintenance_issues: formattedIssues,
      property_key_data: propertyKeyData,
      listing_activity: listingActivity,
      listing_activity_week: listingActivityWeek,
      listing_activity_day: listingActivityDay,
    });
  } catch (error) {
    console.error('Error fetching listings summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
