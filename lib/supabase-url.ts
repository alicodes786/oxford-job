/**
 * `createClient` expects the project base URL only (`https://<ref>.supabase.co`).
 * If `NEXT_PUBLIC_SUPABASE_URL` mistakenly includes `/rest/v1`, requests break with
 * errors like "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (/\/rest\/v1$/i.test(u)) {
    u = u.replace(/\/rest\/v1$/i, '');
  }
  return u.replace(/\/+$/, '');
}
