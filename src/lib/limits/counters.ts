// Shared counters for limits (server-only). Everything lives in the Supabase Postgres so that every server instance sees the same numbers (Vercel runs several):
//   - usage counts (chat questions, drafts, reviews, scans): rows in vault_usage, one per action, counted per browser per India day / rolling week and for ALL browsers per calendar month;
//   - per-minute rate limits (searches, drafting retries and picks): the rate_hits table through the function hit_rate (scripts/w9/w9-schema.sql).
// If Supabase is not configured (a local setup without it) or a call fails, the per-minute limits fall back to a per-process limiter, so a database hiccup never blocks the site.
import { sb, vaultConfigured } from "@/lib/vault/supabase";
import { createRateLimiter } from "@/lib/acts/semantic.mjs";

const istStart = (d = new Date()) => { const ms = d.getTime() + 5.5 * 3600e3, day = Math.floor(ms / 86400e3) * 86400e3; return new Date(day - 5.5 * 3600e3); };
const istMonthStart = () => { const n = new Date(Date.now() + 5.5 * 3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1) - 5.5 * 3600e3); };
export const countersConfigured = () => vaultConfigured();

export type UsageCounts = { day: number; week: number; month: number };
/** This browser's actions of one kind today and in the last 7 days, and ALL browsers' this month. Throws when the counters cannot be read (callers show "could not check limits"). */
export async function usageCounts(bid: string, kind: string): Promise<UsageCounts> {
  const c = async (since: Date, own: boolean) => {
    let q = sb().from("vault_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("at", since.toISOString());
    if (own) q = q.eq("browser_id", bid);
    const r = await q; if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  };
  const [day, week, month] = await Promise.all([c(istStart(), true), c(new Date(Date.now() - 7 * 86400e3), true), c(istMonthStart(), false)]);
  return { day, week, month };
}
/** Records one action; returns its id so it can be taken back (a question that failed is not counted). */
export async function addUsage(bid: string, kind: string): Promise<number> {
  const r = await sb().from("vault_usage").insert({ browser_id: bid, kind }).select("id");
  if (r.error) throw new Error(r.error.message);
  return Number((r.data as { id: number }[])[0].id);
}
export async function removeUsage(id: number) { await sb().from("vault_usage").delete().eq("id", id); }

// ---- per-minute rate limits
const local = new Map<string, ReturnType<typeof createRateLimiter>>();
const localLimiter = (name: string, limit: number, windowSec: number) => { const k = `${name}|${limit}|${windowSec}`; if (!local.has(k)) local.set(k, createRateLimiter({ limit, windowMs: windowSec * 1000 })); return local.get(k)!; };

/** Counts one hit for `key` (for example `search:<address>`). { ok: false, retryAfterSec } once `limit` hits were made within `windowSec` seconds, across all server instances. */
export async function rateCheck(name: string, key: string, limit: number, windowSec = 60): Promise<{ ok: boolean; retryAfterSec: number }> {
  if (countersConfigured()) {
    try {
      const r = await Promise.race([sb().rpc("hit_rate", { p_key: `${name}:${key}`, p_limit: limit, p_window_sec: windowSec }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("slow")), 2500))]);
      if (!r.error && Array.isArray(r.data) && r.data[0]) return { ok: !!r.data[0].ok, retryAfterSec: Number(r.data[0].retry_after_sec ?? 0) };
    } catch { /* fall back below */ }
  }
  return localLimiter(name, limit, windowSec).check(key);
}
