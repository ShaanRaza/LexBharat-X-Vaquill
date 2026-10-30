// Finds the sections a chat answer may use. LOGIC ONLY. The model sees only what is returned here, and citations are checked against it.
//   1. exact section lookups named in the question ("section 138 of the NI Act") come first;
//   2. the question and up to 3 rewritten search queries are each searched with the Acts search (by meaning over Central + State Acts, keyword fallback, lookups for "<Act> section N");
//   3. the lists are merged (a section found by several queries rises) and de-duplicated, then each section's text is loaded.
import { primeSemanticQueries, searchSections, sectionBodies, type SectionHit } from "@/lib/legal-data";
import { extractLookups } from "./lookups.mjs";
import { retrievalQuery, MAX_SOURCES } from "./prompt.mjs";
import { mergeHybrid, mergeRanked } from "./rewrite.mjs";
import { previewOf } from "./format.mjs";
import { scCase, scKeywordConfigured, scSemanticConfigured, searchJudgmentsByMeaning, searchJudgmentsByWords } from "@/lib/legal-data";
import { isFallback, type MeaningCause } from "@/lib/acts/meaning.mjs";
import { meaningFellBack, meaningUsed } from "@/lib/acts/meaningLog";

/** Supreme Court judgment passages close in meaning to the question (at most 3, only clearly relevant ones), as sources of kind "judgment". Empty when the SC projects are not set up or anything fails. */
export async function judgmentSources(question: string, startN: number, onFail?: (cause: MeaningCause, recovered: boolean) => void): Promise<ChatSource[]> {
  if (!scSemanticConfigured()) return [];
  const asSource = async (h: { caseId: string; chunk: number; page: number | null; text: string }, n: number): Promise<ChatSource | null> => {
    const m = await scCase(h.caseId); if (!m) return null;
    return { n, kind: "judgment", caseId: h.caseId, caseYear: m.year, passage: h.chunk, page: h.page, actId: "", sectionKey: "", actTitle: m.c.title, label: m.c.citation ?? null, year: m.year, category: "judgment", state: null, inForce: true, sourceUrl: null, number: null, heading: null, status: "ok", text: h.text, via: "judgment" };
  };
  try {
    const hits = (await searchJudgmentsByMeaning(question, 6)).filter((h) => h.score >= 0.4).slice(0, 3), out: ChatSource[] = [];
    for (const h of hits) {
      const m = await scCase(h.caseId); if (!m) continue;
      out.push({ n: startN + out.length, kind: "judgment", caseId: h.caseId, caseYear: m.year, passage: h.chunk, page: h.page, actId: "", sectionKey: "", actTitle: m.c.title, label: m.c.citation ?? null, year: m.year, category: "judgment", state: null, inForce: true, sourceUrl: null, number: null, heading: null, status: "ok", text: h.text, via: "judgment" });
    }
    meaningUsed("ask_judgments");
    return out;
  } catch (e) {
    const cause = meaningFellBack("ask_judgments", e);   // logged and counted
    // the fallback is the judgments' own word index (loosened for a sentence-style question), 3 passages at most; only when that finds nothing does the answer go without case law, and the reader is told which
    const out: ChatSource[] = [];
    if (scKeywordConfigured()) try { for (const h of (await searchJudgmentsByWords(question, 3, { cap: 12 })).hits) { const s = await asSource(h, startN + out.length); if (s) out.push(s); } } catch { /* nothing more to try */ }
    onFail?.(cause, out.length > 0);
    return out;
  }
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
export type MeaningUse = { used: number; fellBack: number; cause: MeaningCause | null; judgmentsFailed: boolean; /** why the Supreme Court passages could not be found by meaning, and whether exact words found some instead */ judgmentsCause: MeaningCause | null; judgmentsRecovered: boolean };
export type Retrieval = { gaps: LibraryGap[]; sources: ChatSource[]; searchMode: "semantic" | "text" | "lookup" | "none"; note: string; queries: string[]; meaning: MeaningUse; /** old law <-> new law pairs in play (src/lib/chat/concordance.mjs): sections found, and sections the question names that we do not hold */ pairs: Pair[]; /** keys ("actId|sectionKey") found by exact lookup: sections the question or the caller named */ exactKeys: string[] };

const keyOf = (h: SectionHit) => `${h.actId}|${h.sectionKey}`;
import { narrowToExact } from "./exact.mjs";
import { conceptQueries } from "./concepts.mjs";
import { ensureActShare } from "./share.mjs";
import { actSide, counterparts, counterpartsOfLookup, lookupFor, pairsOf, pairsOfNamed, type Pair } from "./concordance.mjs";
import { currentLawFirst } from "./currentlaw.mjs";
import { dedupeCopies } from "@/lib/acts/dedupe.mjs";
import { officialSourceUrl } from "@/lib/acts/quality";
import type { Gap } from "./gaps.mjs";
import replaced from "@/config/replaced-laws.json";

export async function retrieveSources(question: string, history: { role: string; content: string }[] = [], extraQueries: string[] = [], k = MAX_SOURCES, forced: string[] = [], opts: { hybrid?: boolean; currentLaw?: boolean } = {}): Promise<Retrieval> {
  const hits = new Map<string, SectionHit>(), first: string[] = [], lists: string[][] = [], gaps: LibraryGap[] = [];
  let mode: Retrieval["searchMode"] = "none", note = "";
  const meaning: MeaningUse = { used: 0, fellBack: 0, cause: null, judgmentsFailed: false, judgmentsCause: null, judgmentsRecovered: false };
  const usable = (h: SectionHit) => h.status !== "garbled";
  // exact lookups: sections named in the question (2 hits each), then sections the rewritten queries name, such as "Indian Contract Act section 11" (1 hit each; the model's guess is only a lead:
  // what gets cited is the section text that comes back)
  const named = new Set([...forced, ...extractLookups(question)].map((l) => l.toLowerCase()));
  const wanted = [...forced.map((l) => [l, 1] as const), ...extractLookups(question).map((l) => [l, 2] as const), ...extraQueries.flatMap((q) => extractLookups(q)).map((l) => [l, 1] as const)];
  const seenLookup = new Set<string>(), exact: string[] = [], namedMissing: string[] = [], counterKeys: string[] = [];   // exact: units the question itself names ("Order 7 Rule 11", "section 138 of the NI Act")
  for (const [l, take] of wanted.filter(([l]) => !seenLookup.has(l.toLowerCase()) && !!seenLookup.add(l.toLowerCase())).slice(0, Math.max(5, forced.length))) {
    const r = await searchSections(l, 1, 3, { surface: "ask" });
    if (r.available && r.mode === "lookup" && named.has(l.toLowerCase())) {   // a section the QUESTION names (not one the rewrite guessed): not held, or held only as scrambled text -> say so
      if (r.missing) { namedMissing.push(l); gaps.push({ kind: r.missing.beyond ? "nosuch" : "missing", ...(r.missing.beyond ? { max: r.missing.beyond } : {}), number: r.missing.number, actTitle: r.missing.actTitle, actId: r.missing.actId, url: officialSourceUrl(r.missing.sourceUrl) }); }
      else if (r.results.length && r.results.every((h) => !usable(h))) { namedMissing.push(l); gaps.push({ kind: "unreliable", number: r.results[0].number ?? l, actTitle: r.results[0].actTitle, actId: r.results[0].actId, url: officialSourceUrl(r.results[0].sourceUrl) }); }
    }
    if (r.available && r.mode === "lookup") { mode = "lookup"; for (const h of r.results.filter(usable).slice(0, take)) { hits.set(keyOf(h), h); if (!first.includes(keyOf(h))) first.push(keyOf(h)); if (named.has(l.toLowerCase()) && !exact.includes(keyOf(h))) exact.push(keyOf(h)); } }
  }
  // old law <-> new law: a section the question names in one of the six criminal codes brings its confirmed counterpart (confirmed by both Government tables, src/config/law-mapping.json): "IPC 302" also finds BNS 103, "BNS 103" also finds IPC 302
  const fetchCounter = async (l: string, take: number) => {
    const r = await searchSections(l, 1, 3, { surface: "ask" });
    if (!r.available || r.mode !== "lookup") return [] as string[];
    const got: string[] = [];
    for (const h of r.results.filter(usable).slice(0, take)) { hits.set(keyOf(h), h); got.push(keyOf(h)); }
    return got;
  };
  for (const l of [...named].slice(0, 3)) for (const p of counterpartsOfLookup(l).slice(0, 2)) for (const key of await fetchCounter(lookupFor(p), 1)) { if (!first.includes(key)) first.push(key); counterKeys.push(key); }
  // the search queries: the question, the rewrite's queries (one per Act or issue it names), and up to two that name the Act the question's everyday words point to (src/config/concept-acts.json)
  const conceptQs = conceptQueries(question, 2).filter((q) => !extraQueries.some((e) => e.toLowerCase() === q.toLowerCase()));
  const queries = [retrievalQuery(question, history), ...extraQueries, ...conceptQs];
  await primeSemanticQueries(queries);   // one Voyage request for all of them
  const results = await Promise.all(queries.map((q) => searchSections(q, 1, 12, { surface: "ask" }))), listQueries: string[] = [];
  results.forEach((r, i) => {
    if (!r.available) return;
    if (r.semantic?.used) meaning.used++; else if (isFallback(r.semantic)) { meaning.fellBack++; meaning.cause = r.semantic?.cause ?? null; }
    if (i === 0) { note = r.note; if (mode === "none") mode = r.mode; }
    const own = r.results.filter(usable).slice(0, r.mode === "lookup" ? 2 : 8);   // an "<Act> section N" query is an exact hit: keep just the top matches
    own.forEach((h) => hits.set(keyOf(h), h));
    lists.push(own.map(keyOf)); listQueries.push(queries[i]);
  });
  // hybrid (switch): also keyword-search every query. Keyword hits only boost sections the search by meaning found and add at most two of their own at the end (mergeHybrid), so a vague word match can not outrank them
  const kwLists: string[][] = [];
  if (opts.hybrid) {
    const kw = await Promise.all(queries.map((q) => searchSections(q, 1, 12, { exact: true, loose: false })));
    for (const r of kw) { if (!r.available) continue; const own = r.results.filter(usable).slice(0, 8); own.forEach((h) => { if (!hits.has(keyOf(h))) hits.set(keyOf(h), h); }); if (own.length) kwLists.push(own.map(keyOf)); }
  }
  const merge = (n: number) => (opts.hybrid ? mergeHybrid(lists, kwLists, n, first) : mergeRanked(lists, n, first));
  const pool = opts.currentLaw ? merge(40).map((key) => hits.get(key)!).filter(Boolean) : [];
  // a question that touches several Acts: each Act the queries named keeps at least two places among the sections (share.mjs); with one Act the ranking is unchanged
  let keys = ensureActShare(merge(k), lists, listQueries, (key) => { const h = hits.get(key); return h ? { id: h.actId, title: h.actTitle } : null; }, { limit: k, min: 2, protect: first });
  // old law <-> new law for the sections found: the confirmed counterpart goes right after its section (at most three, so the other sources keep their places)
  const cp: string[] = [];
  for (const key of keys.slice(0, 6)) {
    if (cp.length >= 3) break;
    const h = hits.get(key); if (!h || !actSide(h.actTitle)) continue;
    const p = counterparts({ actTitle: h.actTitle, number: h.number }).find((x) => !keys.some((o) => { const g = hits.get(o); return g && actSide(g.actTitle)?.law === x.law && String(g.number).toUpperCase() === x.number.replace(/\(.*$/, "").toUpperCase(); }));
    if (!p) continue;
    const got = await fetchCounter(lookupFor(p), 1); if (!got.length) continue;
    const at = keys.indexOf(key); keys = [...keys.slice(0, at + 1), ...got.filter((g) => !keys.includes(g)), ...keys.slice(at + 1)]; cp.push(...got); counterKeys.push(...got);
  }
  const protectedKeys = new Set([...first, ...counterKeys]);
  while (keys.length > k) { const drop = [...keys].reverse().find((x) => !protectedKeys.has(x)); if (!drop) break; keys.splice(keys.indexOf(drop), 1); }
  let picked = keys.map((key) => hits.get(key)!).filter(Boolean);
  // The question names an exact provision: that unit goes first and sources from unrelated Acts are dropped (a few neighbours from the same Act stay), so the answer check is not confused by noise.
  // (sections the rewrite named, such as the new-law section for an old one, stay with the exact ones)
  picked = dedupeCopies(picked);   // the same section filed under two Act records is one source, never two
  if (exact.length) picked = narrowToExact(picked, [...exact, ...first.filter((k) => !exact.includes(k)), ...counterKeys.filter((c) => !first.includes(c))], keyOf);
  // current law first (switch): a repealed section and its replacement together -> the replacement leads and the old one is marked replaced
  if (opts.currentLaw) picked = currentLawFirst(picked, pool, replaced.pairs, { k, keyOf });
  if (!picked.length) return { gaps, sources: [], searchMode: mode, note, queries, meaning, exactKeys: [], pairs: pairsOfNamed(namedMissing) };
  const body = await sectionBodies(picked.map((h) => ({ actId: h.actId, sectionKey: h.sectionKey })), 9000);
  const sources: ChatSource[] = [];
  for (const h of picked) {
    const text = body.get(keyOf(h))?.body.trim();
    if (!text) continue;
    sources.push({ n: sources.length + 1, actId: h.actId, sectionKey: h.sectionKey, actTitle: h.actTitle, year: h.year, category: h.category, state: h.state, inForce: h.actStatus === "in_force", sourceUrl: h.sourceUrl,
      number: h.number, heading: h.heading, status: h.status, text, via: h.via, ...((h as SectionHit & { replacedBy?: string }).replacedBy ? { replacedBy: (h as SectionHit & { replacedBy?: string }).replacedBy } : {}) });
  }
  sources.push(...(await judgmentSources(retrievalQuery(question, history), sources.length + 1, (cause, recovered) => { meaning.judgmentsFailed = true; meaning.judgmentsCause = cause; meaning.judgmentsRecovered = recovered; })));
  const pairs = [...pairsOf(sources), ...pairsOfNamed(namedMissing, new Set(pairsOf(sources).map((x) => `${x.self.law}|${x.self.number}|${x.partner.number}`)))];
  return { gaps, sources, searchMode: mode, note, queries, meaning, exactKeys: first, pairs };
}

/** What is stored and sent to the browser for a source: no section text. */
export const citationOf = (s: ChatSource) => s.kind === "judgment"
  ? { n: s.n, kind: "judgment" as const, caseId: s.caseId, caseYear: s.caseYear, passage: s.passage, page: s.page ?? null, label: s.label ?? null, actId: "", sectionKey: "", actTitle: s.actTitle, number: null, heading: null, status: "ok", category: "judgment", state: null }
  : s.kind === "doc"
  ? { n: s.n, kind: "doc" as const, docId: s.docId, docName: s.docName, page: s.page ?? null, label: s.label ?? null, ...(s.scan ? { scan: true } : {}), actId: "", sectionKey: "", actTitle: s.docName ?? "Your document", number: null, heading: null, status: "ok", category: "document", state: null, preview: previewOf(s.text) }
  : { n: s.n, actId: s.actId, sectionKey: s.sectionKey, actTitle: s.actTitle, number: s.number, heading: s.heading, status: s.status, category: s.category, state: s.state,
      ...(s.number ? {} : { preview: previewOf(s.text) }) };   // unnumbered text has no section number to show, so it carries a short preview
