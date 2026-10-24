// Reads the text of an India Code Act PDF as clean LINES, position by position (pdf.js through unpdf): drops the diagonal "IndiaCode" watermark, the small raised footnote markers inside
// the text, the footnotes at the foot of each page and the page numbers. It only ever DELETES things from what the PDF contains; it never adds or rewrites a word.
// usage as a module: const lines = await pdfLines(path) -> [{ page, y, size, text }]
import fs from "node:fs";
import { getDocumentProxy } from "unpdf";

const SUP_MAX = 7.6;                       // raised footnote markers are set at about 7 pt; body text is 11, illustrations 8 to 9
const FOOTNOTE = /^\d{1,3}\.\s+(?:Subs\.|Ins\.|Added\b|Omitted\b|Rep\.|The words\b|Cf\.|See\b|Clause\b|Sub-section\b|Re-?numbered|Now\b|Vide\b|Substituted\b|Inserted\b)/;
const isMarker = (s) => /^[\d*†‡]{1,3}$/.test(s.trim());

export async function pdfLines(file) {
  const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file))), out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const glued = new Set();   // a raised footnote number printed in the same text piece as the amendment bracket after it ("13["): the number is dropped, the bracket stays
    for (const it of tc.items) { const g = /^(\d{1,3})(\[.*)$/.exec(it.str); if (g && it.height > 0 && it.height <= SUP_MAX) { glued.add(g[1]); it.str = g[2]; } }
    const items = tc.items.filter((it) => it.str !== "" && it.height > 0 && !(Math.abs(it.transform[1]) > 0.05 || Math.abs(it.transform[2]) > 0.05));   // rotated text = watermark
    // a footnote marker is a short number or asterisk set smaller than the text it sits next to and raised above that text's baseline (also in the 8 to 9 pt illustrations, where it is about 8 pt)
    const isSup = (it) => isMarker(it.str) && (it.height <= SUP_MAX || items.some((o) => o !== it && !isMarker(o.str) && Math.abs(o.transform[4] - it.transform[4]) < 60 && it.transform[5] - o.transform[5] >= 2 && it.transform[5] - o.transform[5] <= 8 && it.height < o.height));
    const sups = items.filter(isSup);
    const markers = new Set([...sups.map((it) => it.str.trim()), ...glued]);
    const markerY = Math.min(...sups.map((it) => it.transform[5]), Infinity);
    const body = items.filter((it) => !isSup(it));
    const rows = [];
    for (const it of body.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
      const y = it.transform[5], row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (row) row.items.push(it); else rows.push({ y, items: [it] });
    }
    let lines = rows.sort((a, b) => b.y - a.y).map((r) => {
      const its = r.items.sort((a, b) => a.transform[4] - b.transform[4]); let text = "", end = null;
      for (const it of its) { const x = it.transform[4]; if (end !== null && x - end > 1.2 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " "; text += it.str; end = x + it.width; }
      text = text.replace(/\s+/g, " ").trim().replace(/\s+([,.;:])/g, "$1").replace(/(\((?:[a-z]{1,3}|[ivx]+|\d{1,3}[A-Z]?)\))(?=[A-Za-z“‘])/g, "$1 ");   // a gap left by a removed marker; a missing space after "(a)"
      return { page: p, y: r.y, size: Math.max(...its.map((i) => i.height)), text, x: its[0].transform[4], xEnd: Math.max(...its.map((i) => i.transform[4] + i.width)), items: its.map((i) => ({ x: i.transform[4], xEnd: i.transform[4] + i.width, str: i.str })) };
    }).filter((l) => l.text);
    // centred lines (cross-headings between sections, "Illustration" labels): equal space left and right, clearly inside the text block
    const left = Math.min(...lines.map((l) => l.x)), right = Math.max(...lines.map((l) => l.xEnd));
    for (const l of lines) l.centered = l.x - left > 40 && Math.abs((l.x - left) - (right - l.xEnd)) < 24;
    // the page number: a lone number near the bottom
    lines = lines.filter((l) => !(l.y < 80 && /^\d{1,4}$/.test(l.text)));
    // the footnotes: from the first small line BELOW the first marker that starts with "<marker number>." to the end of the page
    let cut = -1;
    if (markers.size) cut = lines.findIndex((l) => l.y < markerY - 1 && l.size <= 9.6 && [...markers].some((m) => l.text.startsWith(`${m}.`) || l.text.startsWith(`${m} `)));
    // a footnote whose marker could not be seen (it sits in a heading, or is glued to other text): a small line "N. Subs. by ...", "N. Ins. by ..." and so on
    const cut2 = lines.findIndex((l) => l.y < 160 && FOOTNOTE.test(l.text));
    if (cut2 >= 0 && (cut < 0 || cut2 < cut)) cut = cut2;   // the earlier of the two: footnote 1 can be set in the body's size while footnote 2 is small   // footnotes are at the foot of the page, in the body's size in some PDFs
    if (cut >= 0) lines = lines.slice(0, cut);
    out.push(...lines);
  }
  return out;
}

// CLI: node scripts/supplement/pdf-text.mjs <pdf> <page> prints the cleaned lines of one page (to check the cleaning by eye)
if (process.argv[1]?.endsWith("pdf-text.mjs") && process.argv[2]) {
  const lines = await pdfLines(process.argv[2]), pg = Number(process.argv[3]);
  for (const l of lines) if (!pg || l.page === pg) console.log(`${l.page}|${l.size}| ${l.text}`);
}
