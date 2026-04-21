import { createClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '@/lib/supabase-url';

// `createClient('', …)` throws ("supabaseUrl is required"). That happens during
// `next build` when env files are not loaded (e.g. fresh clone, CI). Use
// placeholders only as a fallback; real URLs/keys from `.env.local` / hosting
// env always win when set.
const supabaseUrl = normalizeSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://placeholder.supabase.co',
);
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  // Public Supabase demo anon JWT — valid shape for the client; not used when real env is set.
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDI4NjE4ODAsImV4cCI6MTk1ODQzNzg4MH0.EtJ_4vLjKhWY4FKjRoGFOd9r32tSN9KETPo_LCXqJ1M';

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