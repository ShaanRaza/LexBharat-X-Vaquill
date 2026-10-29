// THE data-access module for Acts and judgments. Search, Ask, Drafting, the law pages and the judgment pages read the legal data through here and nowhere else, so a new source (a purchased dataset, another
// database, files) is plugged in by changing THIS folder only: nothing in the UI or the answer logic names a table, a SQL statement or a data directory.
// Today the source is the Neon database plus local files (src/lib/acts, src/lib/judgments, src/lib/sections). The small functions below are the contract a new source must provide; the re-exports are the
// existing stores, kept under the same names so they can be replaced one by one. src/lib/legal-data/boundary.test.mjs fails if code outside the data folders touches a legal-data table directly.
//
// NOT part of this module: the app's OWN tables (saved chats, drafts, reviews, usage) use the database connection helper in src/lib/acts/db.ts. If the legal data moves to another database, keep that connection.
import { query, dbConfigured } from "@/lib/acts/db";
import { getCaseText } from "@/lib/judgments/scText";
import { actsTextDir } from "@/lib/acts/sectionText";
import { cleanPlain, vocabOf } from "@/lib/text/clean.mjs";
import { displayTitle } from "@/lib/docs/docType.mjs";

export { dbConfigured as legalDataConfigured } from "@/lib/acts/db";
export { searchSections, primeSemanticQueries, type SectionHit, type SearchOutcome, type SearchFilters } from "@/lib/acts/searchStore";
export { loadActText, type ActTextOutcome } from "@/lib/acts/actText";
export { getActsStore } from "@/lib/acts";
export { getJudgmentsStore } from "@/lib/judgments";
export { getSectionsStore } from "@/lib/sections";
export { scCase } from "@/lib/judgments/scMeta";
export { scSemanticConfigured, scKeywordConfigured, scTextConfigured, searchJudgmentsByMeaning, searchJudgmentsByWords, getCaseText, type ScChunk } from "@/lib/judgments/scText";
export { searchSupremeCourt } from "@/lib/judgments/scSearch";
export { searchHighCourts } from "@/lib/judgments/hcSearch";
export { searchRegulators } from "@/lib/acts/regSearch";
export { numberedLaws } from "@/lib/acts/quickLaws";
export { PAGE_SIZE } from "@/lib/acts/searchStore";
export { parseActsQuery } from "@/lib/acts";
export { resolveMentions, lawsReferred, type Resolved } from "@/lib/judgments/statuteResolve";

/** Can this deployment show and search section text at all (a database or local files)? */
export const sectionTextAvailable = () => dbConfigured() || !!actsTextDir();

export type SectionRef = { actId: string; sectionKey: string };
export type SectionBody = { body: string; actStatus: string; year: number | null; sourceUrl: string | null };
/** The text of many sections at once, cleaned for display (src/lib/text/clean.mjs) and cut to `maxChars` before cleaning: Map "actId|sectionKey" -> body and the Act's status, year and source. Sections without text are left out. */
export async function sectionBodies(refs: SectionRef[], maxChars: number): Promise<Map<string, SectionBody>> {
  const out = new Map<string, SectionBody>();
  if (!refs.length) return out;
  const rows = await query<{ act_id: string; section_key: string; body: string | null; act_status: string; year: number | null; source_url: string | null }>(
    `SELECT s.act_id, s.section_key, left(s.body, $3) AS body, a.act_status, a.year, a.source_url FROM act_sections_v s JOIN acts a ON a.act_id = s.act_id JOIN unnest($1::text[], $2::text[]) AS k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`,
    [refs.map((r) => r.actId), refs.map((r) => r.sectionKey), maxChars]);
  for (const r of rows) { const body = cleanPlain(r.body, vocabOf(String(r.body ?? "").split(/\n+/))); if (body) out.set(`${r.act_id}|${r.section_key}`, { body, actStatus: r.act_status, year: r.year, sourceUrl: r.source_url }); }   // display-clean: the model never reads picture placeholders or amendment numbers
  return out;
}

export type SectionDetail = { title: string; number: string | null; heading: string | null; status: string; body: string | null };
/** One section with its Act's title (cut to 20,000 characters), or null. Throws only when the source itself fails. */
export async function sectionDetail(actId: string, sectionKey: string): Promise<SectionDetail | null> {
  const rows = await query<SectionDetail>(`SELECT a.title, s.number, s.heading, s.status, left(s.body, 20000) AS body FROM act_sections_v s JOIN acts a ON a.act_id = s.act_id WHERE s.act_id = $1 AND s.section_key = $2`, [actId, sectionKey]);
  return rows[0] ? { ...rows[0], title: displayTitle(rows[0].title, { title: rows[0].title }) } : null;
}

/** An excerpt (one passage) of a Supreme Court judgment, or null when the text is not held. */
export async function judgmentExcerpt(caseId: string, passage: number): Promise<{ text: string; page: number | null } | null> {
  const t = await getCaseText(caseId), chunk = t?.chunks.find((c) => c.i === passage) ?? t?.chunks[passage];
  return chunk ? { text: chunk.t, page: chunk.ps } : null;
}

/** For "Laws referred to": which of these section numbers of an Act we hold (number -> section key), and which numbers are known to be missing from the source. Both empty when the source is unavailable. */
export async function sectionPresence(actId: string, numbers: string[]): Promise<{ found: Map<string, string>; missing: Set<number> }> {
  const found = new Map<string, string>(), missing = new Set<number>();
  if (!dbConfigured() || !numbers.length) return { found, missing };
  for (const r of await query<{ number: string; sectionKey: string }>(`SELECT number, section_key AS "sectionKey" FROM act_sections_v WHERE act_id = $1 AND upper(number) = ANY($2::text[])`, [actId, numbers]).catch(() => [])) found.set(r.number.toUpperCase(), r.sectionKey);
  const plain = numbers.filter((n) => /^\d{1,4}$/.test(n)).map(Number);
  if (plain.length) for (const r of await query<{ number: number }>(`SELECT m.number FROM act_missing_sections m WHERE m.act_id = $1 AND m.number = ANY($2::int[]) AND NOT EXISTS (SELECT 1 FROM act_sections_supplement x WHERE x.act_id = m.act_id AND x.number = m.number::text)`, [actId, plain]).catch(() => [])) missing.add(r.number);
  return { found, missing };
}
