import { supabase } from './supabase';
import { Listing } from './models';

// ===== TYPES =====
export interface ParkingPermit {
  id: string;
  listing_id: string | null;
  vehicle_registration: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  parking_days: number;
  platform_link: string | null;
  permit_status: 'permit_os' | 'permit_completed';
  fee_paid_status: 'paid' | 'payment_pending';
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined data
  listing?: Listing;
}

export interface EarlyCheckin {
  id: string;
  listing_id: string | null;
  booking_platform: string | null;
  check_in_date: string | null;
  standard_time: string;
  requested_time: string | null;
  fee_paid: number;
  payment_status: 'payment_requested' | 'payment_made';
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined data
  listing?: Listing;
}

// ===== PARKING PERMITS =====
export const getParkingPermits = async () => {
  const { data, error } = await supabase
    .from('parking_permits')
    .select(`
      *,
      listing:listings(*)
    `)
    .order('check_in_date', { ascending: false });

  if (error) throw error;
  return data as ParkingPermit[];
};

export const createParkingPermit = async (permit: Omit<ParkingPermit, 'id' | 'created_at' | 'updated_at' | 'listing'>) => {
  const { data, error } = await supabase
    .from('parking_permits')
    .insert(permit)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateParkingPermit = async (id: string, updates: Partial<Omit<ParkingPermit, 'id' | 'created_at' | 'updated_at' | 'listing'>>) => {
  const { data, error } = await supabase
    .from('parking_permits')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteParkingPermit = async (id: string) => {
  const { error } = await supabase
    .from('parking_permits')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// ===== EARLY CHECK-INS =====
export const getEarlyCheckins = async () => {
  const { data, error } = await supabase
    .from('early_checkins')
    .select(`
      *,
      listing:listings(*)
    `)
    .order('check_in_date', { ascending: false });

  if (error) throw error;
  return data as EarlyCheckin[];
};

export const createEarlyCheckin = async (checkin: Omit<EarlyCheckin, 'id' | 'created_at' | 'updated_at' | 'listing'>) => {
  const { data, error } = await supabase
    .from('early_checkins')
    .insert(checkin)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateEarlyCheckin = async (id: string, updates: Partial<Omit<EarlyCheckin, 'id' | 'created_at' | 'updated_at' | 'listing'>>) => {
  const { data, error } = await supabase
    .from('early_checkins')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteEarlyCheckin = async (id: string) => {
  const { error } = await supabase
    .from('early_checkins')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

