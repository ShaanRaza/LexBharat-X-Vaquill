// The one Supabase client. Server-only: it uses the SECRET key (SUPABASE_SECRET_KEY), which must never reach the browser, so it is only imported by API routes and server libraries and never under a NEXT_PUBLIC name.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const g = globalThis as unknown as { __sb?: SupabaseClient };
export const vaultConfigured = () => !!process.env.SUPABASE_URL?.trim() && !!process.env.SUPABASE_SECRET_KEY?.trim();
export function sb(): SupabaseClient {
  if (!vaultConfigured()) throw new Error("vault not configured");
  return (g.__sb ??= createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), { auth: { persistSession: false, autoRefreshToken: false } }));
}
