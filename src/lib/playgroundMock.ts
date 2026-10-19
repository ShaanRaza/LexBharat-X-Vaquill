// MOCK BACKEND for the Playground "run" proxy. Nothing here calls a real API.
//
// CONFIRMED (docs/PLAYGROUND-TEARDOWN.md): the envelope { status, ok, body, meta }, the 401 body for a missing key,
// the `meta` fields, the full Pricing body (see PRICING_ROWS), that an unrecognized `state` value is rejected with 422, and that `federal`
// is a valid `state` value on search.
// INFERRED: every other response body (one purpose-built shape per endpoint, invented data, see playgroundFixtures.ts), the 404/409/422
// wording, the rate-limit numbers, which endpoints require a key, and which other endpoints accept `federal`.
import { PRICING_ROWS, SPEC_ENDPOINTS, type SpecEndpoint, type SpecField } from "@/data/playgroundSpec";
import {
  COVERED_CODES, FEDERAL_CORPORA, FEDERAL_COUNTS, HITS, SESSION_LAWS, inScope, jurisdictionName, lawById, lawText, mockSha,
  placeholderText, sectionFor, stateCounts, summary, type Hit,
} from "./playgroundFixtures";

export type RunValues = Record<string, string | number | boolean | string[] | undefined>;
export type RunEnvelope = {
  status: number;
  ok: boolean;
  body: unknown;
  meta: { elapsedMs: number; requestId: string | null; rateLimit: { limit: number | null; remaining: number | null; reset: number | null }; url: string; method: string };
};
type Out = { status?: number; body: unknown };

const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const rid = () => `mock-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}`;
const arr = (v: unknown): string[] => (v === undefined || v === null || v === "" ? [] : (Array.isArray(v) ? v : [v]).map(String));
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toks = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
const err = (status: number, error: string): Out => ({ status, body: { error } });
const lite = (h: Hit) => ({ actId: h.actId, citation: h.citation, title: h.title });

export function findEndpoint(id: string): SpecEndpoint | undefined {
  return SPEC_ENDPOINTS.find((e) => e.id === id && e.runnable);
}

const fail = (status: number, error: string, url = "", method = ""): RunEnvelope => ({
  status, ok: false, body: { error }, meta: { elapsedMs: 0, requestId: null, rateLimit: { limit: null, remaining: null, reset: null }, url, method },
});

// ---- request validation (required -> enum -> numeric range), mirroring the "refused with 422 before anything is charged" wording in the spec
function validate(e: SpecEndpoint, v: RunValues): string | null {
  const missing = e.fields.filter((f) => f.required && empty(v[f.name])).map((f) => f.name);
  if (missing.length) return `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`;
  for (const f of e.fields as SpecField[]) {
    const val = v[f.name];
    if (empty(val)) continue;
    if (f.kind === "enum" && f.enum) {
      const ok = new Set(f.enum.map((t) => t.toLowerCase()));
      const bad = arr(val).find((x) => !ok.has(x.toLowerCase()));
      if (bad !== undefined) return `Invalid ${f.name}: "${bad}". Expected one of: ${f.enum.slice(0, 8).join(", ")}${f.enum.length > 8 ? ", …" : ""}.`;
    }
    if (f.kind === "number") {
      const n = Number(val);
      if (!Number.isFinite(n) || (f.integer && !Number.isInteger(n)) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) return `Invalid ${f.name}: must be ${f.integer ? "a whole number " : "a number "}${f.min !== undefined && f.max !== undefined ? `between ${f.min} and ${f.max}` : f.min !== undefined ? `at least ${f.min}` : "in range"}.`;
    }
  }
  if (arr(v.actIds).length > 50) return "actIds accepts at most 50 values.";
  if (arr(v.corpusType).map((c) => c.toUpperCase()).includes("REGULATION") && !empty(v.state) && arr(v.state).includes("federal")) return "corpusType REGULATION needs a state, not federal.";
  return null;
}

// ---- per-endpoint handlers
function search(v: RunValues): Out {
  const q = String(v.query ?? ""), qn = norm(q), qt = toks(q);
  const corpora = arr(v.corpusType).map((c) => c.toUpperCase()), states = arr(v.state).map((s) => s.toLowerCase()), codes = arr(v.code).map((c) => c.toLowerCase());
  const matchType = String(v.matchType ?? "any");
  const scored = HITS.filter((h) =>
    (!corpora.length || corpora.includes(h.corpusType)) && (!states.length || states.some((s) => inScope(h, s))) && (!codes.length || (h.code && codes.includes(h.code))) &&
    (v.titleNumber === undefined || h.titleNumber === Number(v.titleNumber)) && (!arr(v.chapter).length || (h.chapter && arr(v.chapter).includes(h.chapter))) && (!arr(v.part).length || (h.part && arr(v.part).includes(h.part))) &&
    (!v.excludeRepealed || h.actStatus === "in_force") && (!arr(v.actStatus).length || arr(v.actStatus).includes(h.actStatus)) &&
    (v.yearFrom === undefined || h.year >= Number(v.yearFrom)) && (v.yearTo === undefined || h.year <= Number(v.yearTo)) && (!v.changedSince || h.lastUpdated >= String(v.changedSince)),
  ).map((h) => {
    const hay = `${h.title} ${h.citation} ${h.topics.join(" ")}`.toLowerCase();
    const hits = qt.filter((t) => hay.includes(t)).length;
    const exact = qn !== "" && norm(h.citation) === qn;
    const score = exact ? 1 : qt.length ? hits / qt.length : 0;
    const ok = exact || (matchType === "all" ? hits === qt.length : matchType === "phrase" ? hay.includes(q.toLowerCase().trim()) : true);
    return { h, score, ok };
  }).filter((x) => x.ok).sort((a, b) => b.score - a.score);
  const limit = clamp(num(v.limit, 10), 1, 50), offset = clamp(num(v.offset, 0), 0, 70), want = arr(v.fields);
  const page = scored.slice(offset, offset + limit);
  const results = page.map(({ h, score }, i) => {
    let row: Record<string, unknown> = { ...summary(h, num(v.excerptChars, 500)), rank: offset + i + 1, score: +score.toFixed(3) };
    if (want.length) row = Object.fromEntries(Object.entries(row).filter(([k]) => k === "actId" || k === "citation" || want.includes(k)));
    if (v.includeBody) row.body = placeholderText(h);
    return row;
  });
  return { body: { query: q, matchType, total: scored.length, limit, offset, hasMore: offset + limit < scored.length, creditsConsumed: 4 + (v.includeBody ? 6 * results.length : 0), results } };
}

function count(v: RunValues): Out {
  const corpus = arr(v.corpusType)[0]?.toUpperCase(), st = arr(v.state)[0]?.toLowerCase();
  let n: number;
  if (st && st !== "federal") {
    const c = stateCounts(st);
    n = !c ? 0 : corpus === "REGULATION" ? c.regulations : corpus === "STATE_CONSTITUTION" ? c.constitution : corpus === "STATE_RULES" ? c.courtRules : corpus === "STATE_AGENCY_GUIDANCE" ? c.agencyGuidance : corpus ? c.statutes : c.total;
  } else if (corpus) n = FEDERAL_COUNTS[corpus] ?? 0;
  else n = st === "federal" ? Object.values(FEDERAL_COUNTS).reduce((a, b) => a + b, 0) : 5_400_000;
  const narrowed = ["code", "article", "titleNumber", "chapter", "part"].some((k) => !empty(v[k]));
  if (narrowed) n = Math.max(1, Math.round(n / 40));
  if (v.excludeRepealed) n = Math.round(n * 0.97);
  if (arr(v.actStatus).length && !arr(v.actStatus).includes("in_force")) n = Math.round(n * 0.03);
  return { body: { count: n, scope: Object.fromEntries(Object.entries(v).filter(([, x]) => !empty(x))), narrowed, creditsConsumed: 1 } };
}

const REL = (h: Hit, ids: string[] | undefined, limit: number) => (ids ?? []).slice(0, limit).map((id) => { const s = sectionFor(id); return s ? lite(s) : { actId: id }; });
function section(path: string, v: RunValues): Out {
  const id = String(v.act_id ?? ""); const h = sectionFor(id);
  if (!h) return err(404, `Section not found: ${id}.`);
  const sub = path.replace("/us/statutes/section/{act_id}", "");
  const limit = num(v.limit, 10);
  switch (sub) {
    case "": return { body: { ...summary(h), excerpt: undefined, breadcrumb: [h.corpusType === "USC" || h.corpusType === "CFR" ? `Title ${h.titleNumber}` : h.state.toUpperCase(), h.chapter ? `Chapter ${h.chapter}` : h.part ? `Part ${h.part}` : h.article ? `Article ${h.article}` : "—", h.citation], publicLawCites: h.publicLawCites ?? [], creditsConsumed: 2 } };
    case "/body": {
      const format = String(v.format ?? "both"), text = placeholderText(h);
      return { body: { actId: h.actId, citation: h.citation, format, ...(format !== "text" ? { html: `<p>${text}</p>` } : {}), ...(format !== "html" ? { text } : {}), ...(v.structured ? { subsections: [{ label: "(a)", text: "[mock text] Operative rule." }, { label: "(b)", text: "[mock text] Exception." }] } : {}), asOf: v.asOf ?? null, currentThrough: h.lastUpdated, ...(v.asOf ? { reconstruction: { reliable: false, note: "[mock] Point-in-time text is not reconstructed in the local clone." } } : {}), creditsConsumed: 6 } };
    }
    case "/related": return { body: { actId: h.actId, before: REL(h, h.neighbours?.slice(0, 1), limit), after: REL(h, h.neighbours?.slice(1, 2), limit), creditsConsumed: 2 } };
    case "/changes": {
      const kinds = ["amended", "amended", "renumbered", "amended", "added", "amended"];
      let ev = kinds.map((k, i) => ({ id: 106 - i, kind: k, observedAt: `2025-${String(10 - i).padStart(2, "0")}-0${(i % 8) + 1}`, summary: `[mock] ${k} subsection (${"abcdef"[i]})` }));
      if (v.sinceId !== undefined) ev = ev.filter((e) => e.id > Number(v.sinceId));
      if (v.beforeId !== undefined) ev = ev.filter((e) => e.id < Number(v.beforeId));
      if (v.changeKind) ev = ev.filter((e) => e.kind === v.changeKind);
      if (v.order === "asc") ev.reverse();
      const lim = clamp(num(v.limit, 50), 1, 200);
      return { body: { actId: h.actId, order: v.order ?? "desc", events: ev.slice(0, lim), hasMore: ev.length > lim, creditsConsumed: 1 } };
    }
    case "/cited-by": { const rows = REL(h, h.citedBy, clamp(num(v.limit, 25), 1, 100)); return { body: { actId: h.actId, total: h.citedBy?.length ?? 0, citedBy: rows, creditsConsumed: 2 } }; }
    case "/definitions": return { body: { actId: h.actId, definitions: (h.defined ?? []).map(([term, definition]) => ({ term, definition, scope: "section" })), creditsConsumed: 4 } };
    case "/cross-state": {
      const rows = (h.crossState ?? []).slice(0, clamp(num(v.limit, 5), 1, 52)).map((id, i) => { const s = sectionFor(id); return s ? { state: s.state, ...lite(s), similarity: +(0.86 - i * 0.07).toFixed(2) } : { actId: id }; });
      return { body: { actId: h.actId, comparisons: rows, creditsConsumed: 6 } };
    }
    case "/enactments": {
      const laws = SESSION_LAWS.filter((l) => l.sectionsChanged.includes(h.actId)).map((l) => ({ sessionLawId: l.id, jurisdiction: l.jurisdiction, approvedOn: l.approvedOn, effectiveOn: l.effectiveOn, kind: "amended" }));
      const pls = (h.publicLawCites ?? []).map((p) => ({ publicLaw: p, kind: "enacted" }));
      return { body: { actId: h.actId, enactments: [...pls, ...laws], creditsConsumed: 1 } };
    }
  }
  return err(404, "Unknown section sub-resource.");
}

function sections(v: RunValues): Out {
  const ids = arr(v.actIds), found = ids.map((i) => sectionFor(i)).filter((h): h is Hit => !!h);
  return { body: { requested: ids.length, sections: found.map((h) => ({ ...summary(h), excerpt: undefined, ...(v.includeBody ? { body: placeholderText(h) } : {}) })), notFound: ids.filter((i) => !sectionFor(i)), creditsConsumed: found.length * 2 + (v.includeBody ? found.length * 6 : 0) } };
}

const CITE = /(\d+)\s+(U\.S\.C\.|C\.F\.R\.)\s*§+\s*([\w.\-]+)/gi;
function resolveCite(c: string): Hit | null {
  const n = norm(c), known = HITS.find((h) => norm(h.citation) === n);
  if (known) return known;
  const m = new RegExp(CITE.source, "i").exec(c);
  return m ? sectionFor(`${m[2].toUpperCase().startsWith("U") ? "USC" : "CFR"}_T${m[1]}_S${m[3]}`) : null;
}
const matchOf = (h: Hit | null, st?: string) => (h && inScope(h, st) ? { actId: h.actId, citation: h.citation, title: h.title, corpusType: h.corpusType, state: h.state } : null);
function resolveGet(v: RunValues): Out {
  const m = matchOf(resolveCite(String(v.cite)), arr(v.state)[0]?.toLowerCase());
  return { body: { cite: v.cite, resolved: !!m, match: m, creditsConsumed: m ? 2 : 0 } };
}
function resolvePost(v: RunValues): Out {
  const st = arr(v.state)[0]?.toLowerCase();
  const results = arr(v.citations).map((c) => { const m = matchOf(resolveCite(c), st); return { input: c, resolved: !!m, match: m }; });
  return { body: { results, resolvedCount: results.filter((r) => r.resolved).length, unresolvedCount: results.filter((r) => !r.resolved).length, creditsConsumed: 2 } };
}
function extract(v: RunValues): Out {
  const text = String(v.text ?? ""), st = arr(v.state)[0]?.toLowerCase();
  const found: { text: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(CITE)) found.push({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  for (const h of HITS) { const i = text.indexOf(h.citation); if (i >= 0 && h.corpusType === "STATE" && !found.some((f) => f.start === i)) found.push({ text: h.citation, start: i, end: i + h.citation.length }); }
  found.sort((a, b) => a.start - b.start);
  const doResolve = v.resolve !== false;
  let rows = found.map((f) => { const m = doResolve ? matchOf(resolveCite(f.text), st) : null; return { ...f, resolved: doResolve ? !!m : null, match: m }; });
  if (v.includeUnresolved === false) rows = rows.filter((r) => r.resolved !== false);
  return { body: { textLength: text.length, citations: rows, creditsConsumed: 2 } };
}

const CORPUS_LEGEND: Record<string, string> = { STATE: "state statutory codes", REGULATION: "state administrative regulations", STATE_CONSTITUTION: "state constitutions", STATE_RULES: "state court rules", STATE_AGENCY_GUIDANCE: "state agency guidance" };
function coverage(v: RunValues): Out {
  const st = arr(v.state)[0]?.toLowerCase();
  const rows = COVERED_CODES.filter((c) => !st || c === st).map((c) => { const k = stateCounts(c); return { state: c, name: jurisdictionName(c), corpora: k ? { STATE: k.statutes, REGULATION: k.regulations, STATE_CONSTITUTION: k.constitution, STATE_RULES: k.courtRules, STATE_AGENCY_GUIDANCE: k.agencyGuidance } : {}, totalSections: k?.total ?? 0 }; });
  return { body: { ...(!st || st === "federal" ? { federal: { corpora: FEDERAL_COUNTS } } : {}), jurisdictions: st === "federal" ? [] : rows, legend: { ...CORPUS_LEGEND, ...Object.fromEntries(FEDERAL_CORPORA.map((c) => [c, "federal corpus"])) } } };
}

const TITLES: Record<number, string> = { 1: "General Provisions", 5: "Government Organization and Employees", 11: "Bankruptcy", 15: "Commerce and Trade", 17: "Copyrights", 18: "Crimes and Criminal Procedure", 26: "Internal Revenue Code", 28: "Judiciary and Judicial Procedure", 29: "Labor", 42: "The Public Health and Welfare" };
function divisions(v: RunValues): Out {
  const corpus = String(v.corpusType).toUpperCase(), st = arr(v.state)[0]?.toLowerCase();
  if (["STATE", "REGULATION", "STATE_CONSTITUTION"].includes(corpus) && !st) return err(422, `state is required for corpusType ${corpus}.`);
  if (v.titleNumber !== undefined && (corpus === "USC" || corpus === "CFR")) {
    const t = Number(v.titleNumber);
    return { body: { corpusType: corpus, titleNumber: t, level: "chapter", divisions: ["1", "2", "3"].map((c) => ({ id: `${t}-${c}`, label: `Chapter ${c}`, sectionCount: 40 * Number(c), hasChildren: false })), hasMore: false, nextCursor: null, creditsConsumed: 1 } };
  }
  if (corpus === "USC" || corpus === "CFR") return { body: { corpusType: corpus, level: "title", divisions: Object.entries(TITLES).map(([n, label]) => ({ id: n, titleNumber: Number(n), label: `Title ${n}: ${label}`, sectionCount: 100 + Number(n) * 37, hasChildren: true })), hasMore: false, nextCursor: null, creditsConsumed: 1 } };
  if (corpus === "STATE" || corpus === "REGULATION") return { body: { corpusType: corpus, state: st, level: "code", divisions: ["pe", "civ", "lab"].map((c) => ({ id: `${st}_${c}`, code: `${st}_${c}`, label: `${jurisdictionName(st!) ?? st} ${c.toUpperCase()} code (placeholder)`, sectionCount: 900, hasChildren: true })), hasMore: false, nextCursor: null, creditsConsumed: 1 } };
  return { body: { corpusType: corpus, state: st ?? null, level: "article", divisions: ["Article I", "Article II", "Amendment XIV"].map((a) => ({ id: a, label: a, sectionCount: 12, hasChildren: false })), hasMore: false, nextCursor: null, creditsConsumed: 1 } };
}

const lawRow = (l: (typeof SESSION_LAWS)[number]) => ({ id: l.id, jurisdiction: l.jurisdiction, session: l.session, series: l.series, instrumentType: l.instrumentType, title: l.title, approvedOn: l.approvedOn, effectiveOn: l.effectiveOn, textStatus: l.textStatus, isLaw: l.isLaw, enactmentOutcome: l.enactmentOutcome, updatedAt: l.updatedAt });
function lawList(v: RunValues): Out {
  const q = String(v.q ?? "").toLowerCase();
  const rows = SESSION_LAWS.filter((l) => l.jurisdiction === String(v.jurisdiction).toLowerCase() && (!v.session || l.session === String(v.session)) && (!v.series || l.series === v.series) && (!v.instrumentType || l.instrumentType === v.instrumentType) &&
    (!v.approvedFrom || l.approvedOn >= String(v.approvedFrom)) && (!v.approvedTo || l.approvedOn <= String(v.approvedTo)) && (!v.effectiveFrom || l.effectiveOn >= String(v.effectiveFrom)) && (!v.effectiveTo || l.effectiveOn <= String(v.effectiveTo)) &&
    (v.hasText === undefined || (l.textStatus !== "missing") === Boolean(v.hasText)) && (!v.textStatus || l.textStatus === v.textStatus) && (v.isLaw === undefined || l.isLaw === Boolean(v.isLaw)) &&
    (!v.enactmentOutcome || l.enactmentOutcome === v.enactmentOutcome) && (!v.updatedSince || l.updatedAt >= String(v.updatedSince)) && (!q || l.title.toLowerCase().includes(q)));
  const limit = clamp(num(v.limit, 50), 1, 200);
  return { body: { jurisdiction: String(v.jurisdiction).toLowerCase(), count: rows.length, items: rows.slice(0, limit).map(lawRow), hasMore: rows.length > limit, nextCursor: rows.length > limit ? mockSha(rows[limit - 1].id).slice(0, 12) : null, creditsConsumed: 1 } };
}
function lawSearch(v: RunValues): Out {
  const qt = toks(String(v.query)), limit = clamp(num(v.limit, 10), 1, 50), offset = clamp(num(v.offset, 0), 0, 70);
  const rows = SESSION_LAWS.filter((l) => (!v.jurisdiction || l.jurisdiction === String(v.jurisdiction).toLowerCase()) && (!v.session || l.session === String(v.session)) && (!v.series || l.series === v.series) && (!v.instrumentType || l.instrumentType === v.instrumentType) && (!v.approvedFrom || l.approvedOn >= String(v.approvedFrom)) && (!v.approvedTo || l.approvedOn <= String(v.approvedTo)))
    .map((l) => ({ l, score: qt.length ? qt.filter((t) => l.title.toLowerCase().includes(t)).length / qt.length : 0 })).sort((a, b) => b.score - a.score);
  return { body: { query: v.query, total: rows.length, limit, offset, hasMore: offset + limit < rows.length, creditsConsumed: 4, results: rows.slice(offset, offset + limit).map(({ l, score }) => ({ ...lawRow(l), score: +score.toFixed(3), excerpt: `[mock excerpt] ${l.title}` })) } };
}
function lawGet(v: RunValues): Out {
  const l = lawById(String(v.session_law_id)); if (!l) return err(404, `Session law not found: ${v.session_law_id}.`);
  return { body: { ...lawRow(l), sectionsChanged: l.sectionsChanged.map((id) => { const s = sectionFor(id); return s ? lite(s) : { actId: id }; }), sources: [{ label: "Official source (mock)", url: `https://example.test/mock/session-laws/${l.id}` }], creditsConsumed: 2 } };
}
function lawBody(v: RunValues): Out {
  const l = lawById(String(v.session_law_id)); if (!l) return err(404, `Session law not found: ${v.session_law_id}.`);
  const full = lawText(l), sha = mockSha(full);
  if (v.expectTextSha256 && v.expectTextSha256 !== sha) return err(409, "The stored text no longer matches expectTextSha256.");
  const start = clamp(num(v.startChar, 0), 0, full.length), end = Math.min(full.length, start + 120);
  return { body: { id: l.id, startChar: start, endChar: end, totalChars: full.length, text: full.slice(start, end), textSha256: sha, hasMore: end < full.length, nextCursor: end < full.length ? String(end) : null, creditsConsumed: 6 } };
}
function lawBatch(v: RunValues): Out {
  const ids = arr(v.ids), found = ids.map((i) => lawById(i)).filter((l): l is NonNullable<typeof l> => !!l);
  return { body: { requested: ids.length, items: found.map((l) => ({ ...lawRow(l), ...(v.includeBody ? { text: lawText(l) } : {}) })), notFound: ids.filter((i) => !lawById(i)), creditsConsumed: found.length * 2 + (v.includeBody ? found.length * 6 : 0) } };
}
function lawChanges(v: RunValues): Out {
  const rows = SESSION_LAWS.filter((l) => !v.jurisdiction || l.jurisdiction === String(v.jurisdiction).toLowerCase()).map((l, i) => ({ id: i + 1, sessionLawId: l.id, jurisdiction: l.jurisdiction, kind: i % 2 ? "updated" : "added", at: l.updatedAt })).filter((e) => e.id > num(v.sinceId, 0));
  const lim = clamp(num(v.limit, 50), 1, 200), page = rows.slice(0, lim);
  return { body: { events: page, nextSinceId: page.length ? page[page.length - 1].id : num(v.sinceId, 0), hasMore: rows.length > lim, creditsConsumed: 1 } };
}
function boards(v: RunValues): Out {
  const all = [
    ...["USC", "CFR", "FEDERAL_REGISTER", "AGENCY_GUIDANCE"].map((c) => ({ corpusType: c, state: null as string | null, label: `${c} (federal)`, watchable: true })),
    ...COVERED_CODES.map((c) => ({ corpusType: "STATE", state: c, label: `${jurisdictionName(c)} statutes`, watchable: true })),
  ].filter((b) => (!v.corpusType || b.corpusType === String(v.corpusType).toUpperCase()) && (!v.state || (String(v.state).toLowerCase() === "federal" ? b.state === null : b.state === String(v.state).toLowerCase())));
  const limit = clamp(num(v.limit, 500), 1, 500), offset = num(v.offset, 0);
  return { body: { total: all.length, limit, offset, hasMore: offset + limit < all.length, boards: all.slice(offset, offset + limit) } };
}

function handle(e: SpecEndpoint, v: RunValues): Out {
  const p = e.path.replace("/api/v1", "");
  if (p === "/api-credits/pricing") return { body: { dollarPerCredit: 0.01, minCredits: 500, maxCredits: 1000000, costs: PRICING_ROWS.map(([endpoint, operation, credits, category, description]) => ({ endpoint, operation, credits, usdCost: +(credits * 0.01).toFixed(2), description, category, regions: ["US"] })) } };
  if (p === "/credits/balance") return { body: { balance: 1000, unit: "credits", plan: "pay_as_you_go", updatedAt: "2026-10-20T00:00:00Z" } };
  if (p === "/us/statutes/search") return search(v);
  if (p === "/us/statutes/count") return count(v);
  if (p.startsWith("/us/statutes/section/{act_id}")) return section(p, v);
  if (p === "/us/statutes/sections") return sections(v);
  if (p === "/us/statutes/resolve") return e.method === "GET" ? resolveGet(v) : resolvePost(v);
  if (p === "/us/statutes/extract-citations") return extract(v);
  if (p === "/us/statutes/coverage") return coverage(v);
  if (p === "/us/statutes/divisions") return divisions(v);
  if (p === "/us/session-laws/list") return lawList(v);
  if (p === "/us/session-laws/search") return lawSearch(v);
  if (p === "/us/session-laws/{session_law_id}") return lawGet(v);
  if (p === "/us/session-laws/{session_law_id}/body") return lawBody(v);
  if (p === "/us/session-laws/batch") return lawBatch(v);
  if (p === "/us/session-laws/changes") return lawChanges(v);
  if (p === "/boards") return boards(v);
  return err(501, "Mock not implemented for this endpoint.");
}

/** Validates the request the way the live proxy appears to (key check first, then field rules) and returns the envelope. */
export function runMock(endpointId: string, values: RunValues, apiKey: string | null): RunEnvelope {
  const e = findEndpoint(endpointId);
  if (!e) return fail(404, "Unknown or non-runnable endpoint.");
  if (e.auth && !apiKey) return fail(401, "An API key is required for this endpoint."); // CONFIRMED text
  const url = `https://api.vaquill.ai${e.path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(String(values[k] ?? "")))}`;
  const bad = validate(e, values);
  if (bad) return fail(422, bad, url, e.method); // INFERRED wording
  const out = handle(e, values);
  const status = out.status ?? 200, ok = status >= 200 && status < 300;
  const isPricing = e.path === "/api/v1/api-credits/pricing"; // confirmed shape: left exactly as is, no mock marker fields
  const body = ok && !isPricing && out.body && typeof out.body === "object" && !Array.isArray(out.body)
    ? { _mock: true, _note: "Invented fixture from the local Playground clone; not a real API response (INFERRED shape).", ...(out.body as object) } : out.body;
  return {
    status, ok, body,
    meta: { elapsedMs: 0, requestId: rid(), rateLimit: e.auth ? { limit: 60, remaining: 59, reset: Math.floor(Date.now() / 1000) + 60 } : { limit: null, remaining: null, reset: null }, url, method: e.method },
  };
}

