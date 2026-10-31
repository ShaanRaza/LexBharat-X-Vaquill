// Finds the sections a chat answer may use. LOGIC ONLY. The model sees only what is returned here, and citations are checked against it.
//   1. exact section lookups named in the question ("section 138 of the NI Act") come first;
//   2. the question and up to 3 rewritten search queries are each searched with the Acts search (by meaning over Central + State Acts, keyword fallback, lookups for "<Act> section N");
//   3. the lists are merged (a section found by several queries rises) and de-duplicated, then each section's text is loaded.
import { primeSemanticQueries, searchSections, sectionBodies, isContentsListOf, type SectionHit } from "@/lib/legal-data";
import { extractLookups } from "./lookups.mjs";
import { retrievalQuery, MAX_SOURCES } from "./prompt.mjs";
import { mergeHybrid, mergeRanked } from "./rewrite.mjs";
import { previewOf } from "./format.mjs";
import { scCase, scSemanticConfigured, searchJudgmentsByMeaning } from "@/lib/legal-data";
import { isFallback, type MeaningCause } from "@/lib/acts/meaning.mjs";
import { meaningFellBack, meaningUsed } from "@/lib/acts/meaningLog";

/** Supreme Court judgment passages close in meaning to the question (at most 3, only clearly relevant ones), as sources of kind "judgment". Empty when the SC projects are not set up or anything fails. */
export async function judgmentSources(question: string, startN: number, onFail?: (cause: MeaningCause) => void): Promise<ChatSource[]> {
  if (!scSemanticConfigured()) return [];
  try {
    const hits = (await searchJudgmentsByMeaning(question, 6)).filter((h) => h.score >= 0.4).slice(0, 3), out: ChatSource[] = [];
    for (const h of hits) {
      const m = await scCase(h.caseId); if (!m) continue;
      out.push({ n: startN + out.length, kind: "judgment", caseId: h.caseId, caseYear: m.year, passage: h.chunk, page: h.page, actId: "", sectionKey: "", actTitle: m.c.title, label: m.c.citation ?? null, year: m.year, category: "judgment", state: null, inForce: true, sourceUrl: null, number: null, heading: null, status: "ok", text: h.text, via: "judgment" });
    }
    meaningUsed("ask_judgments");
    return out;
  } catch (e) { onFail?.(meaningFellBack("ask_judgments", e)); return []; }   // logged and counted; the answer simply has no case-law passages, and the reader is told
}

export type ChatSource = {
  n: number; actId: string; sectionKey: string; actTitle: string; year: number | null; category: string; state: string | null; inForce: boolean; sourceUrl: string | null;
  number: string | null; heading: string | null; status: string; text: string; via: string; /** set when the Act is repealed and its replacement is also among the sources */ replacedBy?: string;
  /** a passage of the user's own attached document (see src/lib/vault/search.ts) */
  kind?: "doc" | "judgment"; docId?: string; caseId?: string; caseYear?: number; passage?: number; docName?: string; page?: number | null; label?: string | null; /** the page was read from a scan */ scan?: boolean;
};
/** A section the question names that the library does not hold (or holds only as scrambled text), with where to read it. */
export type LibraryGap = Gap & { actId: string; url: string };
/** How the searches behind one answer ran: `used` searches by meaning answered, `fellBack` fell back to exact words (cause = the last one's), and whether the Supreme Court passages failed. Exact-word and lookup searches that were never meant to use meaning are not counted. */
export type MeaningUse = { used: number; fellBack: number; cause: MeaningCause | null; judgmentsFailed: boolean };
export type Retrieval = { gaps: LibraryGap[]; sources: ChatSource[]; searchMode: "semantic" | "text" | "lookup" | "none"; note: string; queries: string[]; meaning: MeaningUse; /** keys ("actId|sectionKey") found by exact lookup: sections the question or the caller named */ exactKeys: string[] };

const keyOf = (h: SectionHit) => `${h.actId}|${h.sectionKey}`;
import { narrowToExact } from "./exact.mjs";
import { currentLawFirst } from "./currentlaw.mjs";
import { dedupeCopies } from "@/lib/acts/dedupe.mjs";
import { officialSourceUrl } from "@/lib/acts/quality";
import type { Gap } from "./gaps.mjs";
import replaced from "@/config/replaced-laws.json";

export async function retrieveSources(question: string, history: { role: string; content: string }[] = [], extraQueries: string[] = [], k = MAX_SOURCES, forced: string[] = [], opts: { hybrid?: boolean; currentLaw?: boolean } = {}): Promise<Retrieval> {
  const hits = new Map<string, SectionHit>(), first: string[] = [], lists: string[][] = [], gaps: LibraryGap[] = [];
  let mode: Retrieval["searchMode"] = "none", note = "";
  const meaning: MeaningUse = { used: 0, fellBack: 0, cause: null, judgmentsFailed: false };
  const usable = (h: SectionHit) => h.status !== "garbled";
  // exact lookups: sections named in the question (2 hits each), then sections the rewritten queries name, such as "Indian Contract Act section 11" (1 hit each; the model's guess is only a lead:
  // what gets cited is the section text that comes back)
  const named = new Set([...forced, ...extractLookups(question)].map((l) => l.toLowerCase()));
  const wanted = [...forced.map((l) => [l, 1] as const), ...extractLookups(question).map((l) => [l, 2] as const), ...extraQueries.flatMap((q) => extractLookups(q)).map((l) => [l, 1] as const)];
  const seenLookup = new Set<string>(), exact: string[] = [];   // exact: units the question itself names ("Order 7 Rule 11", "section 138 of the NI Act")
  for (const [l, take] of wanted.filter(([l]) => !seenLookup.has(l.toLowerCase()) && !!seenLookup.add(l.toLowerCase())).slice(0, Math.max(5, forced.length))) {
    const r = await searchSections(l, 1, 3, { surface: "ask" });
    if (r.available && r.mode === "lookup" && named.has(l.toLowerCase())) {   // a section the QUESTION names (not one the rewrite guessed): not held, or held only as scrambled text -> say so
      if (r.missing) gaps.push({ kind: r.missing.beyond ? "nosuch" : "missing", ...(r.missing.beyond ? { max: r.missing.beyond } : {}), number: r.missing.number, actTitle: r.missing.actTitle, actId: r.missing.actId, url: officialSourceUrl(r.missing.sourceUrl, r.missing.actTitle) });
      else if (r.results.length && r.results.every((h) => !usable(h))) gaps.push({ kind: "unreliable", number: r.results[0].number ?? l, actTitle: r.results[0].actTitle, actId: r.results[0].actId, url: officialSourceUrl(r.results[0].sourceUrl, r.results[0].actTitle) });
    }
    if (r.available && r.mode === "lookup") { mode = "lookup"; for (const h of r.results.filter(usable).slice(0, take)) { hits.set(keyOf(h), h); if (!first.includes(keyOf(h))) first.push(keyOf(h)); if (named.has(l.toLowerCase()) && !exact.includes(keyOf(h))) exact.push(keyOf(h)); } }
  }
  const queries = [retrievalQuery(question, history), ...extraQueries];
  await primeSemanticQueries(queries);   // one Voyage request for all of them
  const results = await Promise.all(queries.map((q) => searchSections(q, 1, 12, { surface: "ask" })));
  results.forEach((r, i) => {
    if (!r.available) return;
    if (r.semantic?.used) meaning.used++; else if (isFallback(r.semantic)) { meaning.fellBack++; meaning.cause = r.semantic?.cause ?? null; }
    if (i === 0) { note = r.note; if (mode === "none") mode = r.mode; }
    const own = r.results.filter(usable).slice(0, r.mode === "lookup" ? 2 : 8);   // an "<Act> section N" query is an exact hit: keep just the top matches
    own.forEach((h) => hits.set(keyOf(h), h));
    lists.push(own.map(keyOf));
  });
  // hybrid (switch): also keyword-search every query. Keyword hits only boost sections the search by meaning found and add at most two of their own at the end (mergeHybrid), so a vague word match can not outrank them
  const kwLists: string[][] = [];
  if (opts.hybrid) {
    const kw = await Promise.all(queries.map((q) => searchSections(q, 1, 12, { exact: true })));
    for (const r of kw) { if (!r.available) continue; const own = r.results.filter(usable).slice(0, 8); own.forEach((h) => { if (!hits.has(keyOf(h))) hits.set(keyOf(h), h); }); if (own.length) kwLists.push(own.map(keyOf)); }
  }
  const merge = (n: number) => (opts.hybrid ? mergeHybrid(lists, kwLists, n, first) : mergeRanked(lists, n, first));
  const pool = opts.currentLaw ? merge(40).map((key) => hits.get(key)!).filter(Boolean) : [];
  let picked = merge(k).map((key) => hits.get(key)!).filter(Boolean);
  // The question names an exact provision: that unit goes first and sources from unrelated Acts are dropped (a few neighbours from the same Act stay), so the answer check is not confused by noise.
  // (sections the rewrite named, such as the new-law section for an old one, stay with the exact ones)
  picked = dedupeCopies(picked);   // the same section filed under two Act records is one source, never two
  if (exact.length) picked = narrowToExact(picked, [...exact, ...first.filter((k) => !exact.includes(k))], keyOf);
  // current law first (switch): a repealed section and its replacement together -> the replacement leads and the old one is marked replaced
  if (opts.currentLaw) picked = currentLawFirst(picked, pool, replaced.pairs, { k, keyOf });
  if (!picked.length) return { gaps, sources: [], searchMode: mode, note, queries, meaning, exactKeys: [] };
  const body = await sectionBodies(picked.map((h) => ({ actId: h.actId, sectionKey: h.sectionKey })), 9000);
  const sources: ChatSource[] = [];
  for (const h of picked) {
    const text = body.get(keyOf(h))?.body.trim();
    if (!text || (await isContentsListOf(h.actId, h.number, text))) continue;   // an Act's table of contents filed as a section is not the law: never cited (real law text, Schedule lists included, never matches)
    sources.push({ n: sources.length + 1, actId: h.actId, sectionKey: h.sectionKey, actTitle: h.actTitle, year: h.year, category: h.category, state: h.state, inForce: h.actStatus === "in_force", sourceUrl: h.sourceUrl,
      number: h.number, heading: h.heading, status: h.status, text, via: h.via, ...((h as SectionHit & { replacedBy?: string }).replacedBy ? { replacedBy: (h as SectionHit & { replacedBy?: string }).replacedBy } : {}) });
  }
  sources.push(...(await judgmentSources(retrievalQuery(question, history), sources.length + 1, () => { meaning.judgmentsFailed = true; })));
  return { gaps, sources, searchMode: mode, note, queries, meaning, exactKeys: first };
}

/** What is stored and sent to the browser for a source: no section text. */
export const citationOf = (s: ChatSource) => s.kind === "judgment"
  ? { n: s.n, kind: "judgment" as const, caseId: s.caseId, caseYear: s.caseYear, passage: s.passage, page: s.page ?? null, label: s.label ?? null, actId: "", sectionKey: "", actTitle: s.actTitle, number: null, heading: null, status: "ok", category: "judgment", state: null }
  : s.kind === "doc"
  ? { n: s.n, kind: "doc" as const, docId: s.docId, docName: s.docName, page: s.page ?? null, label: s.label ?? null, ...(s.scan ? { scan: true } : {}), actId: "", sectionKey: "", actTitle: s.docName ?? "Your document", number: null, heading: null, status: "ok", category: "document", state: null, preview: previewOf(s.text) }
  : { n: s.n, actId: s.actId, sectionKey: s.sectionKey, actTitle: s.actTitle, number: s.number, heading: s.heading, status: s.status, category: s.category, state: s.state,
      ...(s.number ? {} : { preview: previewOf(s.text) }) };   // unnumbered text has no section number to show, so it carries a short preview
