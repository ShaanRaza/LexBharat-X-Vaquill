// Counts and logs every time search by meaning ran or had to give way to keyword search. Server-only. Best-effort: nothing here may break a search.
//   - a log line per fallback ("[meaning-fallback] {...}": surface, cause, a safe detail; never the query, a key or a connection string) that Vercel's runtime logs can be searched for;
//   - day counters in Supabase (usage_daily: metric meaning_search / meaning_fallback), which /admin reads (Insights) so the rate can be seen across all server instances;
//   - in-process counters since this instance started, which the selftest (/api/vault/selftest) shows.
// Every search path that embeds a query calls meaningUsed or meaningFellBack (src/lib/acts/meaning.test.mjs checks that none is missed).
import { causeOf, safeDetail, type MeaningCause } from "./meaning.mjs";

export type Surface = "acts" | "regulators" | "judgments" | "ask" | "ask_judgments" | "vault";
type Counters = { since: number; searches: Record<string, number>; fellBack: Record<string, number>; partial: Record<string, number>; last?: { at: string; surface: string; cause: string; detail: string } };
const g = globalThis as unknown as { __meaningCounters?: Counters; __meaningWarned?: Set<string> };
const counters = (g.__meaningCounters ??= { since: Date.now(), searches: {}, fellBack: {}, partial: {} });
const warned = (g.__meaningWarned ??= new Set<string>());

const bump = (metric: string, key: string) => { void import("@/lib/insights/server").then((m) => m.bump(metric, key)).catch(() => { /* counters are best-effort */ }); };

/** A search by meaning answered. */
export function meaningUsed(surface: Surface): void {
  counters.searches[surface] = (counters.searches[surface] ?? 0) + 1;
  bump("meaning_search", surface);
}
/** A search by meaning failed (or is not set up) and keyword search answered instead. Returns the cause so the caller can put it in the result. */
export function meaningFellBack(surface: Surface, err: unknown): MeaningCause {
  const cause = causeOf(err), detail = safeDetail(err);
  counters.searches[surface] = (counters.searches[surface] ?? 0) + 1;
  counters.fellBack[`${surface}:${cause}`] = (counters.fellBack[`${surface}:${cause}`] ?? 0) + 1;
  counters.last = { at: new Date().toISOString(), surface, cause, detail };
  // "not set up" is a state, not an incident: written once per instance, not on every search
  if (cause !== "not_configured" || !warned.has(surface)) { warned.add(surface); console.warn("[meaning-fallback]", JSON.stringify({ surface, cause, detail })); }
  bump("meaning_search", surface); bump("meaning_fallback", `${surface}:${cause}`);
  return cause;
}
/** Some vector stores answered and others did not (for example the State Acts database was down): the meaning results lack those corpora. Logged and counted; the search still counts as having used meaning. */
export function meaningPartial(surface: Surface, corpora: string[]): void {
  counters.partial[surface] = (counters.partial[surface] ?? 0) + 1;
  console.warn("[meaning-partial]", JSON.stringify({ surface, failedCorpora: corpora }));
  bump("meaning_partial", surface);
}
/** Counts since this server instance started (the selftest shows them). */
export const meaningSnapshot = () => ({ sinceIso: new Date(counters.since).toISOString(), searches: { ...counters.searches }, fellBack: { ...counters.fellBack }, partial: { ...counters.partial }, last: counters.last ?? null });
