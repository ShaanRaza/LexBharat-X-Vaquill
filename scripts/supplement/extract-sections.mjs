// Cuts the sections we need out of the India Code Act PDFs (via pdf-text.mjs). Never writes a word that is not in the PDF: it finds the line where section N starts ("N. Heading.—text"),
// takes everything up to the line where the next section starts, removes the printed amendment brackets that wrap the whole section, and checks that every word it kept is in the PDF's own text.
// usage: node scripts/supplement/extract-sections.mjs <pdf file> <number> [<number> ...]   (prints each section for you to read; use --json to write a JSON file)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { pdfLines } from "./pdf-text.mjs";
import { listSections, startAt } from "./list-sections.mjs";

const START = (n) => new RegExp(`^\\[?${n}\\.\\s*(.+)$`);                  // "28. Heading.—..." or "[28. Heading.—..."
const ANY_START = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*(.{1,200}?)\.?[”"’]?\s*[—–]/;      // any section start: has "Heading.—"
/** Joins two printed lines: a word broken at a hyphen at the end of the line ("pre-" + "emption") is joined without a space. */
let VOCAB = new Set();   // every word printed in this PDF; decides whether a word broken at a hyphen is one word ("sub-" + "ordinate" = "subordinate") or a compound ("pre-" + "emption" = "pre-emption")
const vocabFor = (lines) => new Set(lines.flatMap((l) => l.text.toLowerCase().split(/[^\p{L}]+/u)).filter((w) => w.length > 2));
const join2 = (a, b) => {
  const m = /([A-Za-z]+)-$/.exec(a), r = /^([a-z]+)/.exec(b);
  if (m && r) return VOCAB.has((m[1] + r[1]).toLowerCase()) ? a.slice(0, -1) + b : a + b;
  return /[0-9]-$/.test(a) && /^[0-9]/.test(b) ? a + b : a + " " + b;
};
const tidy = (s) => s.replace(/\s+([,.;:)])/g, "$1").replace(/\(\s+/g, "(").replace(/\s{2,}/g, " ").trim();

/** Paragraphs from lines: a line starts a new paragraph when it begins "(a)", "(1)", "Explanation", "Illustration(s)", "Provided", "Exception" AND the previous line ended a sentence or a list item (so "clause\n(c) of section 5" stays one sentence). */
function paragraphs(texts) {
  const out = []; let cur = "";
  const startsPara = /^(\[?\s*\((?:[a-z]{1,3}|[ivx]+|\d{1,3}[A-Z]?)\)\s|Explanations?\b|Illustrations?\s*$|Illustrations?\b.{0,3}$|Provided\b|Exceptions?\b|Note\b|[A-Z][^.—]{8,160}\.[—–])/;
  const ended = /([.;:—–\]*]|\bor|\band)\s*$/;
  texts.forEach((t, i) => {
    if (i === 0) { cur = t; return; }
    if (/^Illustrations?\s*$/.test(t) || (startsPara.test(t) && ended.test(cur)) || /^Illustrations?\s*$/.test(cur)) { out.push(cur); cur = t; } else cur = join2(cur, t);
  });
  if (cur) out.push(cur);
  return out.flatMap((x) => tidy(x).split(/(?<=[.\]*;:])\s+(?=\[?(?:Exception|Explanation|Provided that)\b|\[?\s*\(\d{1,2}[A-Z]{0,2}\)\s)/));
}

export { paragraphs };
const PART = /^\[?(PART|CHAPTER)\s+[IVXLCDM\d]+[A-Z]?\b|^\[?(THE\s+)?((FIRST|SECOND|THIRD|FOURTH|FIFTH)\s+)?SCHEDULE\s*[IVX\d]*\s*(\(.{0,40}\))?\s*$/;

/** The section that starts at line index `at` (from listSections) or, when `at` is left out, the one numbered `number`. */
export function cutSection(lines, number, at, opts = {}) {
  const isHeading = opts.isHeading ?? ((l) => l.centered);   // which centred lines are cross-headings printed between sections (dropped); the Constitution passes a stricter test
  VOCAB = vocabFor(lines);
  if (at === undefined) { const hit = listSections(lines).find((x) => x.number === String(number)); if (!hit) return { ok: false, why: `section ${number} is not in the list of sections of this PDF` }; at = hit.line; }
  const st = startAt(lines, at); if (!st) return { ok: false, why: "that line is not a section start" };
  const wanted = st.n, suffix = st.suf;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (PART.test(lines[i].text)) { end = i; break; }
    const s2 = startAt(lines, i);
    if (s2 && (s2.n > wanted || (s2.n === wanted && s2.suf > suffix))) { end = i; break; }
  }
  const texts = lines.slice(at, end).filter((l, k) => k === 0 || !isHeading(l) || /^(Illustrations?|Explanations?\b|STATE AMENDMENTS?\b|[*\s]+$)/i.test(l.text)).map((l) => l.text), pages = [lines[at].page, lines[Math.max(at, end - 1)].page], next = lines[end]?.text.slice(0, 70) ?? "(end of file)";
  if (st.kind === "repealed") {
    // "N. [Heading ...] Rep. by ..." (the bracket can wrap onto the next line) or "[N. Heading.] Omitted by ..."
    const cutJ = texts.findIndex((t, k) => k >= 1 && /^STATE AMENDMENTS?\b/i.test(t)), j = texts.slice(0, cutJ >= 0 ? Math.min(4, cutJ) : 4).reduce((a, b) => (a ? join2(a, b) : b), ""), m = /^\[?\d{1,3}[A-Z]{0,3}\.\s*\[(.+?)\]\s*(.*)$/.exec(j) ?? /^\[\d{1,3}[A-Z]{0,3}\.\s*(.+?)\]\s*(.*)$/.exec(j);
    if (!m) return { ok: false, why: "could not read the repeal note" };
    const used = texts.slice(0, 4).filter((_, k) => k < texts.length).length, cutR = texts.findIndex((t, k) => k >= 1 && /^STATE AMENDMENTS?\b/i.test(t)), tail = texts.slice(used, cutR >= 0 ? cutR : undefined).reduce((a, b) => (a ? join2(a, b) : b), "");
    return { ok: true, repealed: true, heading: tidy(m[1]).replace(/(?<!\b(?:etc|viz|cf))\.$/i, ""), firstLine: texts[0], pages, lineCount: end - at, text: tidy(`${m[2]} ${tail}`), duplicate: null, nextStart: next };
  }
  const headOnly = st.kind === "headOnly", twoLines = st.kind === "wrapped", span = st.span ?? 2;   // span: how many printed lines the heading takes (2, or 3 to 4 for a long heading)
  const joined = headOnly ? `${texts[0]} —` : twoLines ? texts.slice(0, span).join(" ") : texts[0], m0 = /^\[?\d{1,3}[A-Z]{0,3}\.\s*(.*?)\s*[—–]\s*/.exec(joined);
  if (!m0) return { ok: false, why: "could not split heading from text" };
  const heading = tidy(m0[1]).replace(/(?<!\b(?:etc|viz|cf))\.$/i, "");
  const skip = headOnly ? 1 : twoLines ? span : 1;
  const merged = headOnly ? "" : tidy(texts.slice(0, skip).reduce((a, b) => (a ? join2(a, b) : b), ""));
  const rest = merged.slice(merged.search(/[—–]/) + 1).trim();
  // state amendments printed under a section of a Central Act are not part of the Central text
  const all = [rest, ...texts.slice(skip)].filter(Boolean), cutAt = all.findIndex((t) => /^STATE AMENDMENTS?\b/i.test(t) || /\bSTATE AMENDMENTS?\s*$/i.test(t));
  const kept = cutAt >= 0 ? all.slice(0, cutAt) : all;
  while (kept.length && /^[\s*]+$/.test(kept[kept.length - 1])) kept.pop();
  // a cross-heading printed between sections ("Sale", or letter-spaced "S a l e") belongs to neither: a short last line with no closing punctuation after a line that ended a sentence
  for (let k = 0; k < 2 && kept.length > 1; k++) { const last = kept[kept.length - 1], prev = kept[kept.length - 2]; if ((/^(?:\p{L} ){2,}\p{L}$/u.test(last) || (last.length <= 50 && /^[A-Z]/.test(last) && !/[.;:—–\]),*]$/.test(last) && /[.;:\]]$/.test(prev))) && !/^\(/.test(last)) kept.pop(); else break; }
  let text = paragraphs(kept).join("\n");
  // the printed amendment brackets that wrap the whole section: only an unmatched leading "[" or trailing "]" is dropped
  const opens = (text.match(/\[/g) ?? []).length, closes = (text.match(/\]/g) ?? []).length;
  if (opens < closes) text = text.replace(/\]\s*$/, "");
  if (opens > closes) text = text.replace(/^\[\s*/, "");
  text = text.replace(/\n(Illustrations?)\n/g, "\n\n$1\n");
  return { ok: true, heading, firstLine: texts[0], pages, lineCount: end - at, text, duplicate: null, nextStart: next };
}

/** Every alphanumeric word of the section is found, in order, in the PDF's own text (pdftotext) between the pages it spans. Returns the first word that is not. */
export function checkAgainstPdf(file, sec, { loose = false } = {}) {
  const raw = execFileSync("pdftotext", ["-f", String(sec.pages[0]), "-l", String(sec.pages[1] + 1), file, "-"], { maxBuffer: 1 << 28 }).toString().normalize("NFKC").replace(/-[ \t]*\n[ \t]*/g, "");   // a hyphen at the end of a printed line joins the two halves ("sub-" + "section"); a plain "-" inside a line is dropped below
  const words = (s) => s.toLowerCase().normalize("NFKC").replace(/-/g, "").match(/\p{L}+|\p{N}+/gu) ?? [];   // letters and digits are separate words ("3notified" has a footnote number glued on); "pre-emption" and "pre-\nemption" and "preemption" count as the same word
  const hay = words(raw); let j = 0, bad = null;
  for (const w of words(sec.heading + " " + sec.text)) { while (j < hay.length && hay[j] !== w) j++; if (j >= hay.length) { bad = w; break; } j++; }
  if (!bad) return null;
  // the PDF's own text can list the pieces of a page in a different order (an inserted clause before its neighbour): then every word must at least be there as often as we use it
  const count = (arr) => arr.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map()), have = count(hay), need = count(words(sec.heading + " " + sec.text));
  const composite = (w) => { for (let k = loose ? 1 : 2; k <= w.length - (loose ? 1 : 2); k++) if (have.has(w.slice(0, k)) && have.has(w.slice(k))) return true; return false; };   // a word the PDF breaks across lines in an odd place ("sub-" ... "ordinate")
  const glued = (w) => loose && w.length >= 3 && [...have.keys()].some((t) => t.includes(w));   // the PDF's own text layer glues some neighbouring words together ("subNinety", "question-between")
  for (const [w, n] of need) if ((have.get(w) ?? 0) < n && !composite(w) && !glued(w)) return w;
  return null;
}

if (process.argv[1]?.endsWith("extract-sections.mjs") && process.argv[2]) {
  const file = process.argv[2], nums = process.argv.slice(3).filter((a) => !a.startsWith("--")), lines = await pdfLines(file);
  for (const n of nums) {
    const s = cutSection(lines, n);
    if (!s.ok) { console.log(`\n=== ${n}: NOT FOUND (${s.why})`); continue; }
    const bad = checkAgainstPdf(file, s);
    console.log(`\n=== ${n} | heading: ${s.heading} | pages ${s.pages.join("-")} | ${s.lineCount} lines | words in PDF: ${bad ? "MISSING " + bad : "all found"}${s.duplicate ? ` | ALSO STARTS AGAIN: ${s.duplicate}` : ""}\nstarts: ${s.firstLine.slice(0, 90)}\nnext:   ${s.nextStart}\n${s.text}`);
  }
}
