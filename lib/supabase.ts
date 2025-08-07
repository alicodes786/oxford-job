import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type User = {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'sub-admin';
  email: string;
};

export type Task = {
  job_id: number;
  client_name: string;
  job_spec: string;
  pipeline: 'chase info' | 'awaiting info' | 'in progress' | 'awaiting approval' | 'completed' | 'submitted';
  bucket: 'admin' | 'submission' | 'reviews' | 'VAT';
  start_date: string;
  due_date: string;
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  progress: 'not started' | 'in progress' | 'completed';
  last_updated: string;
}; 