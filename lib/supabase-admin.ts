import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from '@/lib/supabase-url';

let cached: SupabaseClient | null = null;

/** Service-role client — server-only (Route Handlers, Server Actions). Never import in client components. */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = rawUrl ? normalizeSupabaseUrl(rawUrl) : '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for dashboard authentication',
    );
  }

  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
