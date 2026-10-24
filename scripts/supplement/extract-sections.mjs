// Cuts the sections we need out of the India Code Act PDFs (via pdf-text.mjs). Never writes a word that is not in the PDF: it finds the line where section N starts ("N. Heading.—text"),
// takes everything up to the line where the next section starts, removes the printed amendment brackets that wrap the whole section, and checks that every word it kept is in the PDF's own text.
// usage: node scripts/supplement/extract-sections.mjs <pdf file> <number> [<number> ...]   (prints each section for you to read; use --json to write a JSON file)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { pdfLines } from "./pdf-text.mjs";

const START = (n) => new RegExp(`^\\[?${n}\\.\\s*(.+)$`);                  // "28. Heading.—..." or "[28. Heading.—..."
const ANY_START = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*(.{1,200}?)\.\s*[—–-]/;      // any section start: has "Heading.—"
/** Joins two printed lines: a word broken at a hyphen at the end of the line ("pre-" + "emption") is joined without a space. */
const join2 = (a, b) => (/[a-z]-$/.test(a) && /^[a-z]/.test(b) ? a + b : a + " " + b);
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

export function cutSection(lines, number) {
  const probe = (i) => (ANY_START.test(lines[i].text) ? lines[i].text : lines[i].text + " " + (lines[i + 1]?.text ?? ""));
  const isStart = (i, n) => START(n).test(lines[i].text) && ANY_START.test(probe(i));
  const idx = lines.findIndex((_, i) => isStart(i, number));
  if (idx < 0) {
    // a repealed or omitted section is printed as "28. [Heading.] Rep. by ..." : heading in brackets, then the note
    const rep = new RegExp(`^\\[?${number}\\.\\s*\\[(.+?)\\.?\\]\\s*((?:Rep\\.|Omitted|Ins\\.|Subs\\.).*)$`), ri = lines.findIndex((l) => rep.test(l.text));
    if (ri < 0) return { ok: false, why: `no line starts with "${number}." and a heading ending in ".—"` };
    const m = rep.exec(lines[ri].text); let e = ri + 1; const parts = [m[2]];
    while (e < lines.length && !/^\[?\d{1,3}[A-Z]{0,3}\.\s/.test(lines[e].text) && !/^(PART|CHAPTER|SCHEDULE)\b/i.test(lines[e].text) && e - ri < 4) parts.push(lines[e++].text);
    return { ok: true, repealed: true, heading: tidy(m[1]), firstLine: lines[ri].text, pages: [lines[ri].page, lines[e - 1].page], lineCount: e - ri, text: tidy(parts.reduce((a, b) => join2(a, b))), duplicate: null, nextStart: lines[e]?.text.slice(0, 70) ?? "(end of file)" };
  }
  const dupe = lines.findIndex((_, i) => i > idx && isStart(i, number));
  let end = lines.length;
  const wanted = parseInt(number, 10), suffix = String(number).replace(/^\d+/, "");
  for (let i = idx + 1; i < lines.length; i++) {
    if (/^(PART|CHAPTER|THE (FIRST|SECOND|THIRD|FOURTH|FIFTH) SCHEDULE|SCHEDULE)\s*[IVXLCDM\d]*[A-Z]?\s*$/i.test(lines[i].text)) { end = i; break; }
    const rp = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*\[.+?\]\s*(?:Rep\.|Omitted|Ins\.|Subs\.)/.exec(lines[i].text);   // a repealed or omitted section ends this one too
    const m = rp ?? ANY_START.exec(probe(i)); if (!m || !/^\[?\d/.test(lines[i].text)) continue;
    if (Number(m[1]) > wanted || (Number(m[1]) === wanted && m[2] > suffix)) { end = i; break; }
  }
  const joined = probe(idx), m0 = /^\[?\d{1,3}[A-Z]{0,3}\.\s*(.*?)\.\s*[—–]\s*/.exec(joined);
  if (!m0) return { ok: false, why: "could not split heading from text" };
  const heading = tidy(m0[1]);
  const texts = lines.slice(idx, end).map((l) => l.text);
  const merged = tidy(texts.slice(0, joined === lines[idx].text ? 1 : 2).reduce((a, b) => (a ? join2(a, b) : b), ""));
  const rest = merged.slice(merged.search(/[—–]/) + 1).trim();
  // state amendments printed under a section of a Central Act are not part of the Central text
  const all = [rest, ...texts.slice(joined === lines[idx].text ? 1 : 2)].filter(Boolean), cutAt = all.findIndex((t) => /^STATE AMENDMENTS?\b/i.test(t) || /\bSTATE AMENDMENTS?\s*$/i.test(t));
  const kept = cutAt >= 0 ? all.slice(0, cutAt) : all;
  while (kept.length && /^[\s*]+$/.test(kept[kept.length - 1])) kept.pop();
  const paras = paragraphs(kept);
  let text = paras.join("\n");
  // the printed amendment brackets that wrap the whole section: only an unmatched leading "[" or trailing "]" is dropped
  const opens = (text.match(/\[/g) ?? []).length, closes = (text.match(/\]/g) ?? []).length;
  if (opens < closes) text = text.replace(/\]\s*$/, "");
  if (opens > closes) text = text.replace(/^\[\s*/, "");
  text = text.replace(/\n(Illustrations?)\n/g, "\n\n$1\n");
  return { ok: true, heading, firstLine: lines[idx].text, pages: [lines[idx].page, lines[Math.max(idx, end - 1)].page], lineCount: end - idx, text, duplicate: dupe >= 0 ? lines[dupe].text.slice(0, 60) : null, nextStart: lines[end]?.text.slice(0, 70) ?? "(end of file)" };
}

/** Every alphanumeric word of the section is found, in order, in the PDF's own text (pdftotext) between the pages it spans. Returns the first word that is not. */
export function checkAgainstPdf(file, sec) {
  const raw = execFileSync("pdftotext", ["-f", String(sec.pages[0]), "-l", String(sec.pages[1] + 1), file, "-"], { maxBuffer: 1 << 28 }).toString().normalize("NFKC");
  const words = (s) => s.toLowerCase().normalize("NFKC").replace(/(\p{L})-\s*(?=\p{L})/gu, "$1").match(/\p{L}+|\p{N}+/gu) ?? [];   // letters and digits are separate words ("3notified" has a footnote number glued on); "pre-emption" and "pre-\nemption" and "preemption" count as the same word
  const hay = words(raw); let j = 0, bad = null;
  for (const w of words(sec.heading + " " + sec.text)) { while (j < hay.length && hay[j] !== w) j++; if (j >= hay.length) { bad = w; break; } j++; }
  if (!bad) return null;
  // the PDF's own text can list the pieces of a page in a different order (an inserted clause before its neighbour): then every word must at least be there as often as we use it
  const count = (arr) => arr.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map()), have = count(hay), need = count(words(sec.heading + " " + sec.text));
  for (const [w, n] of need) if ((have.get(w) ?? 0) < n) return w;
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
