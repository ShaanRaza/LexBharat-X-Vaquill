// Reading scanned pages with a model. PURE logic: the prompt, and how the reply is split back into pages. The model call and the storage are in process.ts / ocr.ts.
export const SCAN_LABEL = "Read from scan — check the original";
export const UNREADABLE_PAGE = "[This page could not be read from the scan.]";
export const BLANK_PAGE = "[blank page]";

/** The instruction for a group of `n` pages (the model is given those pages, in order, as one file). */
export function scanPrompt(n) {
  return [
    `The attached file has ${n} page${n === 1 ? "" : "s"}, each a scan or photo of a document. Transcribe the text of every page exactly as printed or written.`,
    "Rules:",
    "- Keep the original language and script (English, Hindi in Devanagari, or any other). Do not translate, summarise, correct spelling or add anything.",
    "- Keep paragraphs, headings, numbered clauses and lists on separate lines in reading order. Write tables row by row, with cells separated by ' | '.",
    "- Start each page with a line exactly like: === PAGE 1 === (then 2, 3 ... in the order of the pages in the file).",
    `- If a page has no text, write ${BLANK_PAGE} under its marker. If a word cannot be read, write [unclear] in its place; do not guess.`,
    "- Output only the page markers and the transcribed text.",
  ].join("\n");
}

/** Splits the model's reply on its page markers. Returns exactly `n` entries: the page text, or null where the model left a page out. */
export function parseScanOutput(text, n) {
  const out = Array.from({ length: n }, () => null);
  const parts = String(text ?? "").replace(/\r\n?/g, "\n").split(/^\s*=+\s*PAGE\s+(\d+)\s*=+\s*$/im);
  if (parts.length === 1 && n === 1 && parts[0].trim()) { out[0] = clean(parts[0]); return out; }   // a single page the model forgot to mark
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const k = Number(parts[i]);
    if (k >= 1 && k <= n && out[k - 1] === null) out[k - 1] = clean(parts[i + 1]);
  }
  return out;
}
const clean = (s) => { const t = String(s).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); return t === BLANK_PAGE ? "" : t; };

/** Which of the document's image-only pages are read (the first `max`) and how many are skipped. */
export function planScan(scanPages, max) {
  const take = scanPages.slice(0, Math.max(0, max));
  return { take, skipped: scanPages.length - take.length };
}

/** The pages of the finished document: text pages as extracted, scan pages as read ('' for a scan page that was skipped or blank). */
export function mergePages(extracted, scanMap) {
  return extracted.map((p, i) => (scanMap.has(i + 1) ? scanMap.get(i + 1) : p));
}
