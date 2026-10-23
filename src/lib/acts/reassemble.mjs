// Section-text reassembly and quality flags for open-india-law legislation chunks (CC BY 4.0). PURE logic: no file access, no styling, no UI.
// Used by scripts/acts/build-act-text.mjs (build time) and by its tests. The raw chunk text is never edited here; display cleanup lives in cleanText.mjs.
//
// What a chunk id looks like (measured on the v2026.08 snapshot): <act_id>_<token>[_<sub>][_p<N>][_d<N>]
//   token  s<section>   a section ("s138", "s138A", "s045"); b<N> a non-section block ("b022")
//   _<sub> a sub-section / clause index ("_1", "_7") or letter ("_a")
//   _p<N>  part N of a long section; _d<N> a continuation chunk of that part/sub-section
// The dataset has no chunk_index, so the order below is a documented RULE, not ground truth. Every section carries computed flags that say where
// the rule could be wrong (docs/CHUNK-ORDER-VALIDATION.md explains why no order was trusted before).
//
// Section status (computed, in this precedence):
//   garbled              mojibake detected (Devanagari legacy-font extraction, or Latin double-encoding): the text must not be shown
//   possibly_incomplete  U+FFFD (lost characters), a missing/duplicate _p part, a gap in the numeric sub-sections, bare + part/sub chunks mixed in one
//                        section, or a chunk whose own header names a different section
//   complete             none of the above was detected (this means "no problem found", not "proved identical to the Gazette")
// Independent flags: devanagari (Hindi script present), no_section_number (block or chunk with no section number).

const DEVANAGARI = /[ऀ-ॿ]/;
const OTHER_INDIC = /[ঀ-෿]/;

/** Splits a chunk id into the structural parts above. `actId` is the row's act_id (chunk ids start with `${actId}_`). */
export function parseChunkId(chunkId, actId) {
  const rest = chunkId.startsWith(`${actId}_`) ? chunkId.slice(actId.length + 1) : null;
  if (rest === null) return null;
  const toks = rest.split("_");
  const m = /^([sb])([^_]+)$/.exec(toks[0]); // tokens can carry hyphens, brackets and non-ASCII numerals ("s28-I", "s3(A)", "s00९")
  if (!m) return null;
  const subs = [];
  let p = null, d = null;
  for (const t of toks.slice(1)) {
    let k;
    if ((k = /^p(\d+)$/.exec(t))) p = Number(k[1]);
    else if ((k = /^d(\d+)$/.exec(t))) d = Number(k[1]);
    else subs.push(/^\d+$/.test(t) ? { n: Number(t) } : { s: t });
  }
  return { kind: m[1], token: m[2], key: m[1] + m[2], subs, p, d };
}

const toNum = (s) => (/^\d+$/.test(s) ? Number(s) : NaN);
/** Natural order for section tokens: 45 < 45A < 45B < 46; roman/odd tokens fall back to text. */
export function compareTokens(a, b) {
  const pa = /^(\d+)(.*)$/.exec(a), pb = /^(\d+)(.*)$/.exec(b);
  if (pa && pb) return Number(pa[1]) - Number(pb[1]) || pa[2].localeCompare(pb[2]);
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b);
}

/** Order of chunks inside one section: bare chunk, then parts (_p), then sub-sections in order, each followed by its _d continuations. */
export function compareChunks(x, y) {
  const a = x.id, b = y.id;
  const bare = (c) => c.p === null && c.subs.length === 0;
  if (bare(a) !== bare(b)) return bare(a) ? -1 : 1;
  const ap = a.p !== null, bp = b.p !== null;
  if (ap !== bp) return ap ? -1 : 1; // parts before sub-sections
  if (ap && bp && a.p !== b.p) return a.p - b.p;
  for (let i = 0; i < Math.max(a.subs.length, b.subs.length); i++) {
    const s = a.subs[i], t = b.subs[i];
    if (!s) return -1;
    if (!t) return 1;
    const sn = s.n ?? NaN, tn = t.n ?? NaN;
    if (!Number.isNaN(sn) && !Number.isNaN(tn)) { if (sn !== tn) return sn - tn; continue; }
    if (!Number.isNaN(sn)) return -1;
    if (!Number.isNaN(tn)) return 1;
    const c = String(s.s).localeCompare(String(t.s));
    if (c) return c;
  }
  return (a.d ?? -1) - (b.d ?? -1);
}

/** Strips the two dataset-added header lines ("Act: ..." and "Chapter X: ... | Section N: ...") and returns them parsed, plus the untouched body. */
export function splitHeader(text) {
  const lines = text.split("\n");
  let i = 0, chapter = null, sectionNo = null, sectionTitle = null, hadHeader = false;
  if (/^Act: /.test(lines[0] ?? "")) {
    hadHeader = true; i = 1;
    const h = lines[1] ?? "";
    const m = /^(?:Chapter\s+([^:|]+?):\s*(.*?)\s*\|\s*)?Section\s+([^:|]+?):\s*(.*)$/.exec(h);
    if (m) { i = 2; if (m[1]) chapter = { roman: m[1].trim(), name: m[2].trim() }; sectionNo = m[3].trim(); sectionTitle = m[4].trim(); }
    else { const c = /^Chapter\s+([^:|]+?):\s*(.*)$/.exec(h); if (c) { i = 2; chapter = { roman: c[1].trim(), name: c[2].trim() }; } }
    while (i < lines.length && lines[i].trim() === "") i++;
  }
  return { hadHeader, chapter, sectionNo, sectionTitle, body: lines.slice(i).join("\n") };
}

// ---- text-level detectors (counts, not guesses)
/** Words that begin with a Devanagari vowel sign or virama cannot occur in correct Unicode text; legacy-font PDF extraction produces many of them. */
export function mojibakeDevanagari(text) { return (text.match(/(?:^|\s)[ा-्]/g) ?? []).length; }
/** Latin double-encoding (UTF-8 read as Latin-1): "â€™", "Ã©" and similar. */
export function mojibakeLatin(text) { return (text.match(/â€[\u0080-¿™œ‚-›]|Ã[\u0080-¿]/g) ?? []).length; }
export const hasLostCharacters = (text) => text.includes("�");
export const hasDevanagari = (text) => DEVANAGARI.test(text);
export const hasOtherIndic = (text) => OTHER_INDIC.test(text);
export function isGarbled(text) { return mojibakeDevanagari(text) >= 3 || mojibakeLatin(text) >= 3; }
export const devanagariCount = (text) => (text.match(/[\u0900-\u097F]/g) ?? []).length;
/** Hindi in this dataset comes from legacy-font PDFs and is often scrambled in ways no automatic test can tell from correct text (checked: word-start vowel
 *  signs, invalid vowel-sign pairs, and word frequency across Acts all missed scrambled samples). A piece with this many Devanagari characters is therefore
 *  treated as UNVERIFIABLE and is not shown; it stays in the raw text. Short Devanagari fragments (a word or two) are kept and only flagged. */
export const HINDI_PIECE_MIN = 20;

const ROMAN = /^[IVXLCDM]+$/i;
const normRoman = (s) => String(s).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
/** A heading name is "unreliable" when it is letter-spaced (word breaks lost), contains lost characters or mojibake, or is empty. */
export function headingNameReliable(name) {
  if (!name) return false;
  if (/^(?:\S ){3,}\S(?:\s|$)/.test(name) || /(?:^|\s)(?:\S ){5,}\S(?:\s|$)/.test(name)) return false;
  return !(hasLostCharacters(name) || isGarbled(name));
}
const romanValue = (r) => { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let t = 0, prev = 0; for (const ch of r.toUpperCase().split("").reverse()) { const n = v[ch]; t += n < prev ? -n : n; prev = Math.max(prev, n); } return t; };
const chapterNo = (r) => (ROMAN.test(r) ? romanValue(r) : Number.isFinite(Number(r)) ? Number(r) : NaN);
/** A CHAPTER heading written inside the section's own text ("## CHAPTER II") is independent evidence for the chapter number. */
export function embeddedChapter(body) {
  const m = /^\s*(?:#+\s*)?\**\s*CHAPTER\s+([IVXLCDM]+|\d+)[A-Z]?\b/i.exec(body);
  return m ? normRoman(m[1]) : null;
}

/**
 * rows: [{ actId, chunkId, sectionNumber, text }] for ONE act (any order). Returns the act's sections in reading order with flags.
 * Nothing is dropped silently: exact duplicate chunk texts inside a section are collapsed (flag duplicates_collapsed) and chunks that cannot be
 * parsed go into `unparsed`.
 */
export function reassembleAct(rows) {
  const groups = new Map(), unparsed = [];
  for (const r of rows) {
    const id = parseChunkId(r.chunkId, r.actId);
    if (!id) { unparsed.push(r.chunkId); continue; }
    if (!groups.has(id.key)) groups.set(id.key, { key: id.key, kind: id.kind, token: id.token, chunks: [] });
    groups.get(id.key).chunks.push({ id, row: r, head: splitHeader(r.text) });
  }
  const sections = [];
  for (const g of groups.values()) {
    g.chunks.sort(compareChunks);
    const seen = new Set(), kept = [];
    let dup = 0;
    for (const c of g.chunks) { if (seen.has(c.row.text)) { dup++; continue; } seen.add(c.row.text); kept.push(c); }
    const reasons = [], flags = [];
    const fullText = kept.map((c) => c.head.body).join("\n\n");
    const hindi = kept.filter((c) => devanagariCount(c.head.body) >= HINDI_PIECE_MIN), shown = kept.filter((c) => !hindi.includes(c));
    const displayText = hindi.length ? shown.map((c) => c.head.body).join("\n\n") : null; // null = identical to `text`
    const checked = displayText ?? fullText;
    // numbering of the section as the dataset gives it
    const numCol = [...new Set(kept.map((c) => (c.row.sectionNumber ?? "").trim()).filter(Boolean))];
    const noNumber = g.kind === "b" || numCol.length === 0;
    if (noNumber) flags.push("no_section_number");
    // structure checks
    const bare = kept.filter((c) => c.id.p === null && c.id.subs.length === 0), parts = kept.filter((c) => c.id.p !== null && c.id.subs.length === 0), subbed = kept.filter((c) => c.id.subs.length > 0);
    if (bare.length > 0 && (parts.length > 0 || subbed.length > 0)) reasons.push("mixed_structure");
    if (parts.length > 0 && subbed.length > 0) reasons.push("mixed_structure");
    const pIdx = [...new Set(parts.map((c) => c.id.p))].sort((a, b) => a - b);
    if (pIdx.length && (pIdx[0] !== 0 || pIdx.some((v, i) => v !== i))) reasons.push("part_gap");
    const subNums = [...new Set(subbed.map((c) => c.id.subs[0]).filter((s) => s && s.n !== undefined).map((s) => s.n))].sort((a, b) => a - b);
    if (subNums.length > 1 && subNums.some((v, i) => i > 0 && v !== subNums[i - 1] + 1)) reasons.push("sub_gap");
    // a chunk whose own header names another section
    const headerNo = (s) => String(s ?? "").replace(/\(.*$/, "").replace(/^0+/, "").trim().toUpperCase(); // "9(1)" names section 9
    if (g.kind === "s" && kept.some((c) => c.head.sectionNo && !/[a-z]{3,}/i.test(c.head.sectionNo) && headerNo(c.head.sectionNo) !== headerNo(g.token) && headerNo(c.head.sectionNo) !== headerNo(numCol[0]))) reasons.push("header_mismatch");
    if (hasLostCharacters(fullText)) reasons.push("lost_characters");
    const onlyHindi = hindi.length > 0 && shown.length === 0;
    if (hindi.length && !onlyHindi) reasons.push("hindi_pieces_hidden");
    const garbled = onlyHindi || isGarbled(checked);
    if (onlyHindi) flags.push("hindi_unverifiable");
    if (garbled) flags.push("garbled");
    if (hasDevanagari(fullText)) flags.push("devanagari");
    if (hasOtherIndic(fullText) && !garbled) flags.push("other_indic");
    if (dup) flags.push("duplicates_collapsed");
    let status = "complete";
    if (garbled) status = "garbled";
    else if (reasons.length) status = "possibly_incomplete";
    for (const r of reasons) if (!flags.includes(r)) flags.push(r);
    // heading: first usable title; chapters come from the headers and are validated later across the whole act
    const tidy = (t) => (t ?? "").replace(/\*+/g, "").replace(/^#+\s*/, "").trim();
    const titled = kept.find((c) => tidy(c.head.sectionTitle) && tidy(c.head.sectionTitle).length <= 160);
    const chapters = [...new Set(kept.map((c) => c.head.chapter).filter(Boolean).map((c) => `${normRoman(c.roman)}|${tidy(c.name)}`))];
    const embedded = embeddedChapter(kept[0]?.head.body ?? "");
    sections.push({
      key: g.key, kind: g.kind, token: g.token,
      number: g.kind === "s" ? (numCol[0] ?? g.token.replace(/^0+(?=\d)/, "")) : null,
      heading: titled ? tidy(titled.head.sectionTitle) : null,
      chapterRaw: chapters.length === 1 ? { roman: chapters[0].split("|")[0], name: chapters[0].slice(chapters[0].indexOf("|") + 1) } : chapters.length > 1 ? { conflict: chapters } : null,
      embeddedChapter: embedded,
      chunkIds: kept.map((c) => c.row.chunkId), chunkCount: kept.length,
      text: fullText, displayText, status, flags,
    });
  }
  sections.sort((a, b) => (a.kind !== b.kind ? (a.kind === "s" ? -1 : 1) : compareTokens(a.token, b.token)));
  validateChapters(sections);
  return { sections, unparsed };
}

/**
 * Decides, per section, whether its chapter label may be shown. A label passes only when ALL of these hold: the section's chunks agree on one chapter;
 * the chapter name is not letter-spaced/garbled; the number agrees with a CHAPTER heading inside the section text when there is one; the same
 * chapter label forms ONE contiguous run through the act (a label that reappears later is a stale carry-over); and chapter numbers never go backwards.
 * Passing does not prove the label is right (a consistent off-by-one cannot be seen); it removes the failures we can detect.
 */
export function validateChapters(sections) {
  const numbered = sections.filter((s) => s.kind === "s");
  const key = (s) => (s.chapterRaw && s.chapterRaw.roman ? `${s.chapterRaw.roman}|${s.chapterRaw.name.toLowerCase().replace(/\s+/g, " ")}` : null);
  // runs of identical labels in section order
  const runs = new Map(); // label -> [{ start, len }]
  let prev = null, cur = null;
  for (const [i, s] of numbered.entries()) {
    const l = key(s);
    if (l !== prev || !cur) { cur = { start: i, len: 0, label: l }; prev = l; if (l) { if (!runs.has(l)) runs.set(l, []); runs.get(l).push(cur); } }
    cur.len++; s._run = cur;
  }
  const mainRun = (l) => { const rs = runs.get(l), max = Math.max(...rs.map((r) => r.len)); const top = rs.filter((r) => r.len === max); return top.length === 1 ? top[0] : null; };
  // pass 1: per-section checks that do not depend on neighbours' numbers
  for (const s of numbered) {
    const l = key(s), why = [];
    if (!l) why.push(s.chapterRaw?.conflict ? "chunks_disagree" : "no_label");
    else {
      if (!headingNameReliable(s.chapterRaw.name)) why.push("name_unreliable");
      if (s.embeddedChapter && s.embeddedChapter !== s.chapterRaw.roman) why.push("contradicts_embedded_heading");
      if (runs.get(l).length > 1 && mainRun(l) !== s._run) why.push("label_repeats");
      if (Number.isNaN(chapterNo(s.chapterRaw.roman))) why.push("number_unreadable");
    }
    s._why = why;
  }
  // pass 2: chapter numbers must not go backwards among the sections that passed pass 1
  let last = 0;
  for (const s of numbered) {
    if (s._why.length) continue;
    const n = chapterNo(s.chapterRaw.roman);
    if (n < last) s._why.push("goes_backwards"); else last = n;
  }
  for (const s of numbered) {
    s.chapter = s._why.length === 0 ? { roman: s.chapterRaw.roman, name: s.chapterRaw.name } : null;
    s.chapterCheck = s._why.length === 0 ? "pass" : s._why;
    delete s._why; delete s._run;
  }
  for (const s of sections.filter((x) => x.kind !== "s")) { s.chapter = null; s.chapterCheck = ["not_a_section"]; }
}

export const STATUS_ORDER = ["complete", "possibly_incomplete", "garbled"];
export const FLAG_KEYS = ["complete", "possibly_incomplete", "garbled", "devanagari", "no_section_number"];
/** Counts per user-facing flag for a list of sections (a section can count under more than one: status + devanagari + no_section_number). */
export function countFlags(sections, into = {}) {
  const add = (k, n = 1) => { into[k] = (into[k] ?? 0) + n; };
  for (const s of sections) {
    add("sections"); add(s.status);
    if (s.flags.includes("devanagari")) add("devanagari");
    if (s.flags.includes("no_section_number")) add("no_section_number");
    for (const f of s.flags) if (!["devanagari", "no_section_number", "other_indic", "garbled"].includes(f)) add(`reason:${f}`);
    if (s.flags.includes("other_indic")) add("other_indic");
  }
  return into;
}
