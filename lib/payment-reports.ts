import { supabase } from './supabase';
import { format } from 'date-fns';
import { getCleanerById, getCleaners } from './models';
import { CleanerExtraReport, getCleanerExtraReportsForWeek } from './cleaner-extra-reports';

// Helper function to calculate Monday-Sunday boundaries for any date (same as cleaners tab)
function getWeekBoundaries(date: Date) {
  // Clone the date to avoid modifying the original
  const day = new Date(date);
  const dayOfWeek = day.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate Monday (first day of week)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If today is Sunday, Monday was 6 days ago
  const monday = new Date(day);
  monday.setDate(day.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  
  // Calculate Sunday (last day of week) - EXACTLY 6 days after Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return { monday, sunday };
}

export interface PaymentReportData {
  assignments: {
    uuid: string;
    event_uuid: string;
    listing_name: string;
    checkout_date: string;
    hours: number;
    amount: number;
    bank_account?: string;
  }[];
  summary: {
    total_assignments: number;
    total_properties: number;
    total_hours: number;
    total_amount: number;
  };
  breakdown_by_listing: {
    [listing_name: string]: {
      assignments: number;
      hours: number;
      amount: number;
    };
  };
  breakdown_by_bank_account: {
    [bank_account: string]: {
      assignments: number;
      hours: number;
      amount: number;
      properties: string[];
    };
  };
}

export type PaymentReportStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type PaymentReport = {
  id: string;
  cleaner_uuid: string;
  week_start: string;
  total_hours: number;
  total_amount: number;
  base_rate: number;
  status: PaymentReportStatus;
  report_data: PaymentReportData;
  extra_info?: CleanerExtraReport[];  // Updated to be an array
  created_at: string;
  updated_at: string;
  rejection_message?: string;
  // Bank account status tracking
  bank_account_statuses?: {
    [bank_account: string]: {
      status: PaymentReportStatus;
      approved_at?: string;
      paid_at?: string;
    };
  };
};

export interface PaymentReportFilters {
  cleaner_uuid?: string;
  date_from?: Date;
  date_to?: Date;
  page?: number;
  limit?: number;
}

// Get cleaner assignments for a specific week
export async function getCleanerAssignmentsForWeek(cleanerUuid: string, weekStart: Date, weekEnd: Date) {
  console.log(`Getting assignments for cleaner ${cleanerUuid} from ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
  
  const { data: assignments, error } = await supabase
    .from('cleaner_assignments')
    .select(`
      *,
      event:event_uuid(
        uuid,
        listing_name,
        checkout_date,
        listing_hours
      )
    `)
    .eq('cleaner_uuid', cleanerUuid)
    .eq('is_active', true);

  if (error) throw error;
  
  console.log(`Found ${assignments?.length || 0} total assignments for cleaner`);
  
  // Filter by date range on the client side to ensure we have the event data
  const weekFilteredAssignments = assignments?.filter(assignment => {
    if (!assignment.event?.checkout_date) {
      console.log(`Skipping assignment ${assignment.uuid} - no checkout_date`);
      return false;
    }
    
    const checkoutDate = new Date(assignment.event.checkout_date);
    const isInWeek = checkoutDate >= weekStart && checkoutDate <= weekEnd;
    
    console.log(`Assignment ${assignment.uuid}: checkout_date=${assignment.event.checkout_date}, isInWeek=${isInWeek}`);
    
    return isInWeek;
  }) || [];
  
  console.log(`Found ${weekFilteredAssignments.length} assignments in date range`);
  
  // Get bank account information for each assignment
  const assignmentsWithBankAccount = await Promise.all(
    weekFilteredAssignments.map(async (assignment) => {
      if (!assignment.event?.listing_name) {
        return { ...assignment, bank_account: null };
      }
      
      // Get bank account from listings table
      const { data: listing } = await supabase
        .from('listings')
        .select('bank_account')
        .eq('name', assignment.event.listing_name)
        .single();
      
      return {
        ...assignment,
        bank_account: listing?.bank_account || null
      };
    })
  );
  
  return assignmentsWithBankAccount;
}

// Calculate report data from assignments and include extra hours
export function calculateReportData(assignments: any[], hourlyRate: number, extraReports?: CleanerExtraReport[]): PaymentReportData {
  console.log(`Calculating report data for ${assignments.length} assignments with hourly rate ${hourlyRate}`);
  console.log(`Including ${extraReports?.length || 0} extra hour reports`);
  
  const reportData: PaymentReportData = {
    assignments: [],
    summary: {
      total_assignments: 0,
      total_properties: 0,
      total_hours: 0,
      total_amount: 0
    },
    breakdown_by_listing: {},
    breakdown_by_bank_account: {}
  };

  // Process regular assignments first
  assignments.forEach((assignment, index) => {
    const hours = assignment.event?.listing_hours 
      ? parseFloat(assignment.event.listing_hours.toString()) 
      : parseFloat(assignment.hours.toString());
    
    // Round hours to 2 decimal places to avoid floating point issues
    const roundedHours = Math.round(hours * 100) / 100;
    
    // Calculate amount with proper rounding
    const amount = Math.round(roundedHours * hourlyRate * 100) / 100;

    console.log(`Assignment ${index + 1}: ${assignment.event?.listing_name} - ${roundedHours} hours × £${hourlyRate} = £${amount}`);

    // Add to assignments array
    reportData.assignments.push({
      uuid: assignment.uuid,
      event_uuid: assignment.event_uuid,
      listing_name: assignment.event?.listing_name || 'Unknown Property',
      checkout_date: assignment.event?.checkout_date,
      hours: roundedHours,
      amount: amount,
      bank_account: assignment.bank_account || null
    });

    // Update summary
    reportData.summary.total_assignments++;
    reportData.summary.total_hours = Math.round((reportData.summary.total_hours + roundedHours) * 100) / 100;
    reportData.summary.total_amount = Math.round((reportData.summary.total_amount + amount) * 100) / 100;

    // Update breakdown by listing
    const listingName = assignment.event?.listing_name || 'Unknown Property';
    if (!reportData.breakdown_by_listing[listingName]) {
      reportData.breakdown_by_listing[listingName] = {
        assignments: 0,
        hours: 0,
        amount: 0
      };
    }
    reportData.breakdown_by_listing[listingName].assignments++;
    reportData.breakdown_by_listing[listingName].hours = Math.round((reportData.breakdown_by_listing[listingName].hours + roundedHours) * 100) / 100;
    reportData.breakdown_by_listing[listingName].amount = Math.round((reportData.breakdown_by_listing[listingName].amount + amount) * 100) / 100;

    // Update breakdown by bank account
    const bankAccount = assignment.bank_account || 'Unknown Bank Account';
    if (!reportData.breakdown_by_bank_account[bankAccount]) {
      reportData.breakdown_by_bank_account[bankAccount] = {
        assignments: 0,
        hours: 0,
        amount: 0,
        properties: []
      };
    }
    reportData.breakdown_by_bank_account[bankAccount].assignments++;
    reportData.breakdown_by_bank_account[bankAccount].hours = Math.round((reportData.breakdown_by_bank_account[bankAccount].hours + roundedHours) * 100) / 100;
    reportData.breakdown_by_bank_account[bankAccount].amount = Math.round((reportData.breakdown_by_bank_account[bankAccount].amount + amount) * 100) / 100;
    if (assignment.event?.listing_name && !reportData.breakdown_by_bank_account[bankAccount].properties.includes(assignment.event.listing_name)) {
      reportData.breakdown_by_bank_account[bankAccount].properties.push(assignment.event.listing_name);
    }
  });

  // Process extra hour reports
  if (extraReports && extraReports.length > 0) {
    extraReports.forEach((extraReport, index) => {
      if (extraReport.extra_hours > 0 && extraReport.listing_id) {
        // We need to get listing details to determine the rate
        // For now, we'll use the base hourly rate, but we should enhance this to use listing-specific rates
        const extraHours = Math.round(extraReport.extra_hours * 100) / 100;
        const extraAmount = Math.round(extraHours * hourlyRate * 100) / 100;

        console.log(`Extra Hours ${index + 1}: Listing ${extraReport.listing_id} - ${extraHours} hours × £${hourlyRate} = £${extraAmount}`);

        // Add to summary totals
        reportData.summary.total_hours = Math.round((reportData.summary.total_hours + extraHours) * 100) / 100;
        reportData.summary.total_amount = Math.round((reportData.summary.total_amount + extraAmount) * 100) / 100;

        // Note: We'll need to enhance this to properly handle listing names and bank accounts for extra hours
        // For now, we'll add a placeholder that can be enhanced when we have listing data available
      }
    });
  }

  // Calculate total unique properties
  reportData.summary.total_properties = Object.keys(reportData.breakdown_by_listing).length;

  console.log(`Final summary: ${reportData.summary.total_assignments} assignments, ${reportData.summary.total_hours} hours, £${reportData.summary.total_amount}`);
  
  return reportData;
}

// Enhanced version that properly handles extra hours with listing data
export async function calculateReportDataWithExtraHours(assignments: any[], hourlyRate: number, cleanerUuid: string, weekStart: string): Promise<PaymentReportData> {
  console.log(`Calculating enhanced report data for ${assignments.length} assignments`);
  
  // Get extra reports for this cleaner and week
  const extraReports = await getCleanerExtraReportsForWeek(cleanerUuid, weekStart);
  console.log(`Found ${extraReports.length} extra hour reports`);
  
  const reportData: PaymentReportData = {
    assignments: [],
    summary: {
      total_assignments: 0,
      total_properties: 0,
      total_hours: 0,
      total_amount: 0
    },
    breakdown_by_listing: {},
    breakdown_by_bank_account: {}
  };

  // Process regular assignments first
  assignments.forEach((assignment, index) => {
    const hours = assignment.event?.listing_hours 
      ? parseFloat(assignment.event.listing_hours.toString()) 
      : parseFloat(assignment.hours.toString());
    
    const roundedHours = Math.round(hours * 100) / 100;
    const amount = Math.round(roundedHours * hourlyRate * 100) / 100;

    console.log(`Assignment ${index + 1}: ${assignment.event?.listing_name} - ${roundedHours} hours × £${hourlyRate} = £${amount}`);

    reportData.assignments.push({
      uuid: assignment.uuid,
      event_uuid: assignment.event_uuid,
      listing_name: assignment.event?.listing_name || 'Unknown Property',
      checkout_date: assignment.event?.checkout_date,
      hours: roundedHours,
      amount: amount,
      bank_account: assignment.bank_account || null
    });

    // Update summary
    reportData.summary.total_assignments++;
    reportData.summary.total_hours = Math.round((reportData.summary.total_hours + roundedHours) * 100) / 100;
    reportData.summary.total_amount = Math.round((reportData.summary.total_amount + amount) * 100) / 100;

    // Update breakdown by listing
    const listingName = assignment.event?.listing_name || 'Unknown Property';
    if (!reportData.breakdown_by_listing[listingName]) {
      reportData.breakdown_by_listing[listingName] = {
        assignments: 0,
        hours: 0,
        amount: 0
      };
    }
    reportData.breakdown_by_listing[listingName].assignments++;
    reportData.breakdown_by_listing[listingName].hours = Math.round((reportData.breakdown_by_listing[listingName].hours + roundedHours) * 100) / 100;
    reportData.breakdown_by_listing[listingName].amount = Math.round((reportData.breakdown_by_listing[listingName].amount + amount) * 100) / 100;

    // Update breakdown by bank account
    const bankAccount = assignment.bank_account || 'Unknown Bank Account';
    if (!reportData.breakdown_by_bank_account[bankAccount]) {
      reportData.breakdown_by_bank_account[bankAccount] = {
        assignments: 0,
        hours: 0,
        amount: 0,
        properties: []
      };
    }
    reportData.breakdown_by_bank_account[bankAccount].assignments++;
    reportData.breakdown_by_bank_account[bankAccount].hours = Math.round((reportData.breakdown_by_bank_account[bankAccount].hours + roundedHours) * 100) / 100;
    reportData.breakdown_by_bank_account[bankAccount].amount = Math.round((reportData.breakdown_by_bank_account[bankAccount].amount + amount) * 100) / 100;
    if (assignment.event?.listing_name && !reportData.breakdown_by_bank_account[bankAccount].properties.includes(assignment.event.listing_name)) {
      reportData.breakdown_by_bank_account[bankAccount].properties.push(assignment.event.listing_name);
    }
  });

  // Process extra hour reports with listing data
  for (const extraReport of extraReports) {
    if (extraReport.extra_hours > 0 && extraReport.listing_id) {
      try {
        // Get listing details
        const { data: listing } = await supabase
          .from('listings')
          .select('name, hours, bank_account')
          .eq('id', extraReport.listing_id)
          .single();

        if (listing) {
          const extraHours = Math.round(extraReport.extra_hours * 100) / 100;
          const extraAmount = Math.round(extraHours * hourlyRate * 100) / 100;

          console.log(`Extra Hours for ${listing.name}: ${extraHours} hours × £${hourlyRate} = £${extraAmount}`);

          // Add extra hours assignment to the assignments array
          reportData.assignments.push({
            uuid: `extra-${extraReport.id}`,
            event_uuid: `extra-${extraReport.id}`,
            listing_name: `${listing.name} (Extra Hours)`,
            checkout_date: extraReport.week_start_date,
            hours: extraHours,
            amount: extraAmount,
            bank_account: listing.bank_account
          });

          // Add to summary totals
          reportData.summary.total_assignments++;
          reportData.summary.total_hours = Math.round((reportData.summary.total_hours + extraHours) * 100) / 100;
          reportData.summary.total_amount = Math.round((reportData.summary.total_amount + extraAmount) * 100) / 100;

          // Update breakdown by listing
          const listingName = `${listing.name} (Extra Hours)`;
          if (!reportData.breakdown_by_listing[listingName]) {
            reportData.breakdown_by_listing[listingName] = {
              assignments: 0,
              hours: 0,
              amount: 0
            };
          }
          reportData.breakdown_by_listing[listingName].assignments++;
          reportData.breakdown_by_listing[listingName].hours = Math.round((reportData.breakdown_by_listing[listingName].hours + extraHours) * 100) / 100;
          reportData.breakdown_by_listing[listingName].amount = Math.round((reportData.breakdown_by_listing[listingName].amount + extraAmount) * 100) / 100;

          // Update breakdown by bank account
          const bankAccount = listing.bank_account || 'Unknown Bank Account';
          if (!reportData.breakdown_by_bank_account[bankAccount]) {
            reportData.breakdown_by_bank_account[bankAccount] = {
              assignments: 0,
              hours: 0,
              amount: 0,
              properties: []
            };
          }
          reportData.breakdown_by_bank_account[bankAccount].assignments++;
          reportData.breakdown_by_bank_account[bankAccount].hours = Math.round((reportData.breakdown_by_bank_account[bankAccount].hours + extraHours) * 100) / 100;
          reportData.breakdown_by_bank_account[bankAccount].amount = Math.round((reportData.breakdown_by_bank_account[bankAccount].amount + extraAmount) * 100) / 100;
          if (!reportData.breakdown_by_bank_account[bankAccount].properties.includes(listing.name)) {
            reportData.breakdown_by_bank_account[bankAccount].properties.push(listing.name);
          }
        }
      } catch (error) {
        console.error(`Error processing extra hours for listing ${extraReport.listing_id}:`, error);
      }
    }
  }

  // Calculate total unique properties (excluding extra hours entries)
  const uniqueListings = new Set();
  reportData.assignments.forEach(assignment => {
    if (!assignment.listing_name.includes('(Extra Hours)')) {
      uniqueListings.add(assignment.listing_name);
    }
  });
  reportData.summary.total_properties = uniqueListings.size;

  console.log(`Enhanced final summary: ${reportData.summary.total_assignments} total entries, ${reportData.summary.total_hours} hours, £${reportData.summary.total_amount}`);
  
  return reportData;
}

// Generate reports for all cleaners or a specific cleaner
export async function generateWeeklyReport(cleanerUuid: string | null, weekStartDate: Date) {
  try {
    // Add debug logging to see what we received
    console.log('=== WEEK CALCULATION DEBUG ===');
    console.log('Received weekStartDate:', weekStartDate.toISOString());
    console.log('Received weekStartDate local:', weekStartDate.toLocaleDateString());
    console.log('Received weekStartDate day of week:', weekStartDate.getDay(), '(0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)');
    
    // Show what startOfWeek will calculate
    const weekStart = getWeekBoundaries(weekStartDate).monday;
    const weekEnd = getWeekBoundaries(weekStartDate).sunday;
    
    console.log('Calculated week start:', weekStart.toISOString());
    console.log('Calculated week start local:', weekStart.toLocaleDateString());
    console.log('Calculated week start day of week:', weekStart.getDay());
    console.log('Calculated week end:', weekEnd.toISOString());
    console.log('Calculated week end local:', weekEnd.toLocaleDateString());
    console.log(`Final week range: ${format(weekStart, 'yyyy-MM-dd')} to ${format(weekEnd, 'yyyy-MM-dd')}`);
    console.log('=== END DEBUG ===');

    // Get cleaners to generate reports for
    const cleaners = cleanerUuid 
      ? [await getCleanerById(cleanerUuid)]
      : await getCleaners();

    if (!cleaners || cleaners.length === 0) {
      throw new Error('No cleaners found');
    }

    // Generate reports for each cleaner
    const reports = await Promise.all(
      cleaners.map(async (cleaner) => {
        if (!cleaner) return null;

        console.log(`Processing cleaner: ${cleaner.name} (${cleaner.id})`);

        // STEP 1: Delete existing reports for this cleaner and week
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        
        const { data: existingReports, error: findError } = await supabase
          .from('cleaner_payment_reports')
          .select('id')
          .eq('cleaner_uuid', cleaner.id)
          .eq('week_start', weekStartStr)
          .eq('week_end', weekEndStr);

        if (findError) {
          console.error('Error finding existing reports:', findError);
        } else if (existingReports && existingReports.length > 0) {
          console.log(`Found ${existingReports.length} existing reports for ${cleaner.name} for week ${weekStartStr}. Deleting...`);
          
          const { error: deleteError } = await supabase
            .from('cleaner_payment_reports')
            .delete()
            .in('id', existingReports.map(r => r.id));
            
          if (deleteError) {
            console.error('Error deleting existing reports:', deleteError);
          } else {
            console.log(`Successfully deleted ${existingReports.length} existing reports`);
          }
        }

        // STEP 2: Get assignments for the week
        const assignments = await getCleanerAssignmentsForWeek(cleaner.id, weekStart, weekEnd);

        // STEP 3: Calculate report data with enhanced extra hours support
        const reportData = await calculateReportDataWithExtraHours(assignments, cleaner.hourly_rate, cleaner.id, weekStartStr);

        // STEP 4: Create report record
        const { data: newReport, error: insertError } = await supabase
          .from('cleaner_payment_reports')
          .insert({
            cleaner_uuid: cleaner.id,
            week_start: weekStartStr,
            week_end: weekEndStr,
            total_hours: reportData.summary.total_hours,
            base_rate: cleaner.hourly_rate,
            total_amount: reportData.summary.total_amount,
            report_data: reportData
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        console.log(`Created new report for ${cleaner.name}: ${reportData.summary.total_hours} hours, £${reportData.summary.total_amount}`);
        
        return newReport;
      })
    );

    // Filter out null reports and return
    return reports.filter(Boolean);
  } catch (error) {
    console.error('Error generating weekly report(s):', error);
    throw error;
  }
}

// Get a specific payment report
export async function getPaymentReport(reportId: string) {
  const { data: report, error } = await supabase
    .from('cleaner_payment_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error) throw error;
  return report;
}

// Get payment report by ID with extra info
export async function getPaymentReportWithExtraInfo(reportId: string): Promise<PaymentReport> {
  // First get the report
  const { data: report, error: reportError } = await supabase
    .from('cleaner_payment_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportError) {
    console.error('Error fetching payment report:', reportError);
    throw reportError;
  }

  if (!report) {
    throw new Error('Report not found');
  }

  // Then get all extra info for this report
  const { data: extraInfo, error: extraError } = await supabase
    .from('cleaner_extra_reports')
    .select('*')
    .eq('cleaner_uuid', report.cleaner_uuid)
    .eq('week_start_date', report.week_start)
    .order('created_at', { ascending: true });

  if (extraError) {
    console.error('Error fetching extra info:', extraError);
    throw extraError;
  }

  // Return combined data
  return {
    ...report,
    extra_info: extraInfo || []
  };
}

// List payment reports with filters and extra info
export async function listPaymentReports(filters: PaymentReportFilters) {
  let query = supabase
    .from('cleaner_payment_reports')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.cleaner_uuid) {
    query = query.eq('cleaner_uuid', filters.cleaner_uuid);
  }

  // Apply date range filters
  if (filters.date_from) {
    query = query.gte('week_start', format(filters.date_from, 'yyyy-MM-dd'));
  }

  if (filters.date_to) {
    query = query.lte('week_start', format(filters.date_to, 'yyyy-MM-dd'));
  }

  // Apply pagination
  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const offset = (page - 1) * limit;

  query = query
    .order('week_start', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: reports, error, count } = await query;

  if (error) throw error;
  
  // Fetch extra info for each report
  const reportsWithExtraInfo = await Promise.all(
    (reports || []).map(async (report) => {
      const { data: extraInfo, error: extraError } = await supabase
        .from('cleaner_extra_reports')
        .select('*')
        .eq('cleaner_uuid', report.cleaner_uuid)
        .eq('week_start_date', report.week_start)
        .order('created_at', { ascending: true });

      if (extraError) {
        console.error('Error fetching extra info for report:', report.id, extraError);
      }

      return {
        ...report,
        extra_info: extraInfo || []  // Return array of extra info reports
      };
    })
  );

  return { reports: reportsWithExtraInfo, count, page, limit };
}

// Function to find and remove duplicate reports
export async function cleanupDuplicateReports() {
  try {
    const { data: allReports, error } = await supabase
      .from('cleaner_payment_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const errors: string[] = [];
    const duplicatesToDelete: string[] = [];

    // Group reports by cleaner + week
    const groupedReports: { [key: string]: any[] } = {};
    allReports?.forEach(report => {
      const key = `${report.cleaner_uuid}-${report.week_start}`;
      if (!groupedReports[key]) {
        groupedReports[key] = [];
      }
      groupedReports[key].push(report);
    });

    // Find duplicates
    Object.values(groupedReports).forEach(reports => {
      if (reports.length > 1) {
        const [keepReport, ...duplicates] = reports;
        console.log(`Found ${duplicates.length} duplicates for cleaner ${keepReport.cleaner_uuid} week ${keepReport.week_start}`);
        console.log(`Keeping report ${keepReport.id} (created: ${keepReport.created_at})`);

        duplicates.forEach(duplicate => {
          console.log(`Marking duplicate for deletion: ${duplicate.id} (created: ${duplicate.created_at})`);
          duplicatesToDelete.push(duplicate.id);
        });
      }
    });

    // Delete duplicates
    if (duplicatesToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('cleaner_payment_reports')
        .delete()
        .in('id', duplicatesToDelete);

      if (deleteError) {
        errors.push(`Error deleting duplicates: ${deleteError.message}`);
      }
    }

    return {
      duplicatesRemoved: duplicatesToDelete.length,
      errors
    };
  } catch (error) {
    console.error('Error in cleanupDuplicateReports:', error);
    throw error;
  }
}

// Get duplicate reports summary for inspection
export async function getDuplicateReportsSummary() {
  try {
    const { data: allReports, error } = await supabase
      .from('cleaner_payment_reports')
      .select('id, cleaner_uuid, week_start, week_end, total_hours, total_amount, created_at')
      .order('cleaner_uuid', { ascending: true })
      .order('week_start', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    if (!allReports || allReports.length === 0) {
      return { duplicateGroups: [], totalDuplicates: 0 };
    }

    // Group reports by cleaner_uuid + week_start + week_end
    const groupedReports: { [key: string]: any[] } = {};
    
    allReports.forEach(report => {
      const key = `${report.cleaner_uuid}-${report.week_start}-${report.week_end}`;
      if (!groupedReports[key]) {
        groupedReports[key] = [];
      }
      groupedReports[key].push(report);
    });

    // Find only the groups with duplicates
    const duplicateGroups = Object.entries(groupedReports)
      .filter(([key, reports]) => reports.length > 1)
      .map(([key, reports]) => ({
        key,
        cleaner_uuid: reports[0].cleaner_uuid,
        week_start: reports[0].week_start,
        week_end: reports[0].week_end,
        count: reports.length,
        reports: reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }));

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0);

    return { duplicateGroups, totalDuplicates };
  } catch (error) {
    console.error('Error in getDuplicateReportsSummary:', error);
    throw error;
  }
}