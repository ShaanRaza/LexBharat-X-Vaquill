// Exports of a draft: .docx (Word and Google Docs) and PDF, built from the blocks in docmodel.mjs. PURE of app state (bytes in, bytes out). No styling system: print layout only.
// Placeholders such as [TENANT'S ADDRESS] are highlighted in both. The PDF embeds Noto Serif (Latin, Latin Extended) and Noto Serif Devanagari (SIL Open Font License, see fonts/README.md), choosing a font per
// character, so "₹" prints as "₹" and Devanagari text is covered for later Hindi drafts. Both exports keep the rupee sign.
import "regenerator-runtime/runtime.js";   // @pdf-lib/fontkit needs this global to shape Devanagari
import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { AlignmentType, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber, Paragraph, TextRun } from "docx";
import { PDFDocument, rgb } from "pdf-lib";

export const DISCLAIMER = "Draft for review by a qualified lawyer. Not legal advice.";
const PLACEHOLDER = /(\[[A-Z][A-Z0-9 '’\/&.,:-]{2,80}\])/;
const segments = (text) => text.split(PLACEHOLDER).filter(Boolean).map((t) => ({ text: t, hl: PLACEHOLDER.test(t) && /^\[/.test(t) && /\]$/.test(t) }));

// ---------------- .docx
function docxRuns(runs, base = {}) {
  const out = [];
  for (const r of runs) {
    r.text.split("\n").forEach((line, i) => {
      segments(line).forEach((seg, j) => out.push(new TextRun({ text: seg.text, bold: r.bold || base.bold, italics: r.italics, underline: r.underline ? {} : undefined, highlight: seg.hl ? "yellow" : undefined,
        break: i > 0 && j === 0 ? 1 : undefined, font: "Times New Roman", size: base.size ?? 24 })));
      if (i > 0 && !line) out.push(new TextRun({ text: "", break: 1 }));   // an empty line between two line breaks
    });
  }
  return out.length ? out : [new TextRun({ text: "", font: "Times New Roman", size: 24 })];
}

export async function buildDocx(blocks, meta = {}) {
  const children = []; let listNo = 0; const numberedRefs = [];
  for (const b of blocks) {
    if (b.type === "heading") children.push(new Paragraph({ heading: b.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, alignment: b.level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { before: b.level === 1 ? 0 : 240, after: 120 }, children: docxRuns(b.runs, { bold: true, size: b.level === 1 ? 28 : 24 }) }));
    else if (b.type === "p") children.push(new Paragraph({ spacing: { after: 140, line: 300 }, alignment: AlignmentType.JUSTIFIED, children: docxRuns(b.runs) }));
    else {
      listNo++; const ref = `numbered-${listNo}`;
      if (b.ordered) numberedRefs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, start: b.start ?? 1, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });   // one definition per list, so each can start at its own number
      for (const it of b.items) children.push(new Paragraph({ spacing: { after: 100, line: 300 }, alignment: AlignmentType.JUSTIFIED, numbering: b.ordered ? { reference: ref, level: 0 } : { reference: "bullets", level: 0 }, children: docxRuns(it) }));
    }
  }
  const doc = new Document({
    creator: "LexBharat draft", title: meta.title ?? "Draft", description: DISCLAIMER,
    numbering: { config: [
      ...numberedRefs,
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ] },
    styles: { default: { document: { run: { font: "Times New Roman", size: 24 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${DISCLAIMER}  Page `, size: 16, font: "Times New Roman", color: "666666" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Times New Roman", color: "666666" })] })] }) },
      children }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

// ---------------- PDF
const A4 = [595.28, 841.89], MARGIN = 72, BODY = 11.5;
// font files (src/lib/drafting/fonts; next.config.mjs includes the folder in the traced files for the export route)
const FONT_DIR = path.join(process.cwd(), "src", "lib", "drafting", "fonts");
const FONT_FILES = { "latin-r": "noto-serif-latin-400-normal.woff", "latin-b": "noto-serif-latin-700-normal.woff", "latin-i": "noto-serif-latin-400-italic.woff", "latin-bi": "noto-serif-latin-700-italic.woff",
  "ext-r": "noto-serif-latin-ext-400-normal.woff", "ext-b": "noto-serif-latin-ext-700-normal.woff", "deva-r": "noto-serif-devanagari-devanagari-400-normal.woff", "deva-b": "noto-serif-devanagari-devanagari-700-normal.woff" };

/** Splits text into runs that each use one font: the style's Latin font first, then Latin Extended, then Devanagari; a character none of them has becomes "?". fonts: { chain: [{ font, has: Set }] }. */
export function fontRuns(text, chain) {
  const runs = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    let hit = chain.find((c) => c.has.has(cp)) ?? (cp === 10 || cp === 32 ? chain[0] : null);
    const [font, out] = hit ? [hit.font, ch] : [chain[0].font, "?"];
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += out; else runs.push({ text: out, font });
  }
  return runs;
}

export async function buildPdf(blocks, meta = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.title ?? "Draft"); pdf.setCreator("LexBharat draft"); pdf.setSubject(DISCLAIMER);
  pdf.registerFontkit(fontkit);
  const emb = {}; for (const [k, f] of Object.entries(FONT_FILES)) { const font = await pdf.embedFont(fs.readFileSync(path.join(FONT_DIR, f)), { subset: true }); emb[k] = { font, has: new Set(font.getCharacterSet()) }; }
  const F = { r: emb["latin-r"].font };   // used for list numbers and the footer
  // the font chain for a style: its Latin font, then Latin Extended and Devanagari (bold or regular; those two have no italic)
  const chainOf = (r) => { const base = r.bold ? "b" : "r"; return [emb[`latin-${r.bold && r.italics ? "bi" : r.bold ? "b" : r.italics ? "i" : "r"}`], emb[`ext-${base}`], emb[`deva-${base}`]]; };
  let page = pdf.addPage(A4), y = A4[1] - MARGIN;
  const maxW = A4[0] - 2 * MARGIN;
  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - MARGIN; };
  const need = (h) => { if (y - h < MARGIN) newPage(); };

  // words with style, from runs
  const wordsOf = (runs, extraBold) => {
    const w = [];
    for (const r of runs) {
      const chain = chainOf({ ...r, bold: r.bold || extraBold });
      for (const [li, line] of r.text.split("\n").entries()) {
        if (li > 0) w.push({ br: true });
        for (const seg of segments(line)) for (const fr of fontRuns(seg.text, chain)) for (const word of fr.text.split(/(\s+)/).filter((x) => x !== "")) w.push({ word, font: fr.font, hl: seg.hl, underline: r.underline });
      }
    }
    return w;
  };
  const drawBlock = ({ runs, size, indent = 0, firstPrefix = "", align = "left", bold = false, after = 7, before = 0 }) => {
    const x0 = MARGIN + indent, lh = size * 1.38;
    const prefixW = firstPrefix ? F.r.widthOfTextAtSize(firstPrefix, size) : 0, hang = prefixW;   // list items hang: continuation lines line up with the text, not the number
    y -= before;
    const words = wordsOf(runs, bold);
    let line = [], lw = 0, first = true; const lines = [];
    const room = () => maxW - indent - (first ? prefixW : hang);
    const push = () => { lines.push(line); line = []; lw = 0; first = false; };
    for (const wd of words) {
      if (wd.br) { push(); continue; }
      const isSpace = /^\s+$/.test(wd.word), w = wd.font.widthOfTextAtSize(wd.word, size);
      if (isSpace && lw === 0) continue;
      if (!isSpace && lw + w > room() && lw > 0) { while (line.length && /^\s+$/.test(line[line.length - 1].word)) line.pop(); push(); }
      line.push({ ...wd, w }); lw += w;
    }
    if (line.length) push();
    lines.forEach((ln, idx) => {
      need(lh);
      while (ln.length && /^\s+$/.test(ln[ln.length - 1].word)) ln.pop();
      // merge neighbouring pieces that share font, highlight and underline into one drawn string, so spaces are real characters in the PDF text
      const groups = [];
      for (const t of ln) { const g = groups[groups.length - 1]; if (g && g.font === t.font && g.hl === t.hl && g.underline === t.underline) { g.text += t.word; g.w += t.w; } else groups.push({ text: t.word, font: t.font, hl: t.hl, underline: t.underline, w: t.w }); }
      const total = groups.reduce((a, g) => a + g.w, 0);
      let x = align === "center" ? MARGIN + (maxW - total) / 2 : x0 + (idx === 0 ? 0 : hang) + (idx === 0 ? 0 : 0);
      y -= lh;
      if (idx === 0 && firstPrefix) { page.drawText(firstPrefix.trimEnd(), { x: x0, y, size, font: F.r, color: rgb(0.1, 0.1, 0.1) }); x = x0 + prefixW; }
      else if (idx > 0 && firstPrefix) x = x0 + hang;
      for (const g of groups) {
        if (g.hl) page.drawRectangle({ x, y: y - size * 0.22, width: g.w, height: size * 1.05, color: rgb(1, 0.93, 0.45) });
        if (g.text.trim()) page.drawText(g.text, { x, y, size, font: g.font, color: rgb(0.1, 0.1, 0.1) });
        if (g.underline && g.text.trim()) page.drawLine({ start: { x, y: y - 1.5 }, end: { x: x + g.w, y: y - 1.5 }, thickness: 0.5, color: rgb(0.1, 0.1, 0.1) });
        x += g.w;
      }
    });
    y -= after;
  };

  for (const b of blocks) {
    if (b.type === "heading") drawBlock({ runs: b.runs, size: b.level === 1 ? 14 : BODY, bold: true, align: b.level === 1 ? "center" : "left", before: b.level === 1 ? 0 : 8, after: 6 });
    else if (b.type === "p") drawBlock({ runs: b.runs, size: BODY });
    else b.items.forEach((it, i) => drawBlock({ runs: it, size: BODY, indent: 22, firstPrefix: b.ordered ? `${(b.start ?? 1) + i}.  ` : "•  ", after: 4 }));
  }
  const pages = pdf.getPages(), n = pages.length;
  pages.forEach((p, i) => {
    p.drawText(DISCLAIMER, { x: MARGIN, y: 36, size: 8, font: F.r, color: rgb(0.4, 0.4, 0.4) });
    const label = `Page ${i + 1} of ${n}`; p.drawText(label, { x: A4[0] - MARGIN - F.r.widthOfTextAtSize(label, 8), y: 36, size: 8, font: F.r, color: rgb(0.4, 0.4, 0.4) });
  });
  return await pdf.save();
}
