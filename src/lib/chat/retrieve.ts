// Finds the sections a chat answer may use: exact section lookups named in the question ("section 138 of the NI Act") first, then the Acts search (by meaning over Central + State Acts,
// keyword fallback), each with its text. LOGIC ONLY. The model sees only what is returned here, and citations are checked against it.
import { query } from "@/lib/acts/db";
import { searchSections, type SectionHit } from "@/lib/acts/searchStore";
import { extractLookups } from "./lookups.mjs";
import { retrievalQuery, MAX_SOURCES } from "./prompt.mjs";

export type ChatSource = {
  n: number; actId: string; sectionKey: string; actTitle: string; year: number | null; category: string; state: string | null; inForce: boolean; sourceUrl: string | null;
  number: string | null; heading: string | null; status: string; text: string; via: string;
};
export type Retrieval = { sources: ChatSource[]; searchMode: "semantic" | "text" | "lookup" | "none"; note: string };

export async function retrieveSources(question: string, history: { role: string; content: string }[] = [], k = MAX_SOURCES): Promise<Retrieval> {
  const picked: SectionHit[] = []; const seen = new Set<string>();
  const take = (hits: SectionHit[], max: number) => { for (const h of hits) { const key = `${h.actId}|${h.sectionKey}`; if (seen.has(key) || h.status === "garbled" || picked.length >= k || max-- <= 0) continue; seen.add(key); picked.push(h); } };
  let mode: Retrieval["searchMode"] = "none", note = "";
  for (const l of extractLookups(question)) {
    const r = await searchSections(l, 1, 3);
    if (r.available && r.mode === "lookup") { take(r.results, 2); mode = "lookup"; }
  }
  const r = await searchSections(retrievalQuery(question, history), 1, 12);
  if (r.available) { take(r.results, k); if (mode === "none") mode = r.mode; note = r.note; }
  if (!picked.length) return { sources: [], searchMode: mode, note };
  const rows = await query<{ act_id: string; section_key: string; body: string | null }>(
    `SELECT s.act_id, s.section_key, left(s.body, 4000) AS body FROM act_sections s JOIN unnest($1::text[], $2::text[]) AS k(a, sk) ON s.act_id = k.a AND s.section_key = k.sk`, [picked.map((h) => h.actId), picked.map((h) => h.sectionKey)]);
  const body = new Map(rows.map((x) => [`${x.act_id}|${x.section_key}`, x.body ?? ""]));
  const sources: ChatSource[] = [];
  for (const h of picked) {
    const text = body.get(`${h.actId}|${h.sectionKey}`)?.trim();
    if (!text) continue;
    sources.push({ n: sources.length + 1, actId: h.actId, sectionKey: h.sectionKey, actTitle: h.actTitle, year: h.year, category: h.category, state: h.state, inForce: h.actStatus === "in_force", sourceUrl: h.sourceUrl,
      number: h.number, heading: h.heading, status: h.status, text, via: h.via });
  }
  return { sources, searchMode: mode, note };
}

/** What is stored and sent to the browser for a source: no section text. */
export const citationOf = (s: ChatSource) => ({ n: s.n, actId: s.actId, sectionKey: s.sectionKey, actTitle: s.actTitle, number: s.number, heading: s.heading, status: s.status, category: s.category, state: s.state });
