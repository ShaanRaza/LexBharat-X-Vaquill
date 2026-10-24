// The Constitution of India from India Code's text PDF ("As on <date>", Legislative Department pocket edition): every Article (including lettered ones such as 21A and 243ZH) and each of the twelve Schedules as
// a unit, with the Part / Chapter / cross-heading each Article sits under. Same line reader and word check as the Acts (pdf-text.mjs, list-sections.mjs, extract-sections.mjs).
import { pdfLines } from "./pdf-text.mjs";
import { listSections } from "./list-sections.mjs";
import { cutSection, paragraphs } from "./extract-sections.mjs";

/** Lines of the PDF without the running heads printed at the top of every page ("9 THE CONSTITUTION OF INDIA" and the centred "(Part III.—Fundamental Rights)" under it). */
export async function constitutionLines(file) {
  const lines = await pdfLines(file), out = []; let page = 0, drop = 0;
  for (const l of lines) {
    if (l.page !== page) { page = l.page; drop = /^\d*\s*THE CONSTITUTION OF INDIA\s*\d*$/.test(l.text) ? 1 : 0; if (drop) continue; }
    else if (drop === 1 && l.centered && /^\((Part [IVX]+[A-Z]?\.|.*Schedule|Appendix)/i.test(l.text)) { if (/\)$/.test(l.text)) drop = 0; continue; }   // the part or schedule title in brackets under it (it can wrap onto a second line)
    else drop = 0;
    out.push(l);
  }
  // Footnotes at the foot of a Schedule page are printed smaller than the body and start "1. Ins. by ...": cut each page from its first numbered small line when everything after it is small too
  const pages = new Map(); out.forEach((l, i) => { (pages.get(l.page) ?? pages.set(l.page, []).get(l.page)).push(i); });
  const cut = new Set();
  for (const idx of pages.values()) {
    const FOOT = /^\d{1,2}\.?\s*(Ins\.|Subs\.|Added|Omitted|Rep\.|The |Clause|Sub-|Paragraph|Entry|Items?|Cl\.|Article|Para\b|Words?|Now|Entries|See)/;
    let e = -1; for (let k = 0; k < idx.length; k++) { const x = out[idx[k]]; if (x.size < 13.3 && x.y < 460 && FOOT.test(x.text)) { e = k; break; } }   // the first footnote line (printed small, low on the page); everything after it on the page is footnote
    if (e >= 0) for (let k = e; k < idx.length; k++) cut.add(idx[k]);
  }
  return out.filter((_, i) => !cut.has(i));
}

const PART = /^\[?PART\s+([IVX]+[A-Z]?)\b/, CHAPTER = /^\[?CHAPTER\s+[IVX]+/;
/** A centred line that is a cross-heading ("Right to Freedom", "[Saving of Certain Laws]") and not an indented list item or a line of a clause. */
export const isCrossHeading = (l) => l.centered && l.text.length <= 100 && !/^[(\d*]/.test(l.text) && !/[;,:]\]?$/.test(l.text) && !PART.test(l.text) && !CHAPTER.test(l.text) && /^\[?[A-Z]/.test(l.text);

/** Every Article: [{ number, line, ok, heading, text, pages, chapter, repealed }], with the heading context ("PART III — FUNDAMENTAL RIGHTS · Right to Freedom"). */
/** A footnote that the PDF printed inside a line of text ("(date yet to be 1.Ins. by the Constitution (One Hundred and Sixth Amendment) Act, 2023, s.4 (w.e.f. 16-4-2026). notified)"): removed from the text. */
const INLINE_FOOT = /\s*\b\d{1,2}\.?\s*(?:Ins|Subs)\. by the Constitution \([^)]*\) Act, \d{4}, s\.\s*\d+[^()]*?\(w\.e\.f\. [\d-]+\)\.?/g;

export function articleUnits(lines) {
  const list = listSections(lines), at = new Map(list.map((x) => [x.line, x]));
  let part = "", chapter = "", sub = "", i = list[0].line;
  // walk back to the start of the first Part so that "PART I" is the context of Article 1
  while (i > 0 && !PART.test(lines[i].text)) i--;
  const units = [];
  const ctx = () => [part, chapter, sub].filter(Boolean).join(" · ");
  for (let k = i; k <= list.at(-1).line; k++) {
    const x = lines[k];
    if (at.has(k)) { const a = at.get(k), s = cutSection(lines, a.number, k, { isHeading: isCrossHeading }); if (s.ok) s.text = s.text.replace(INLINE_FOOT, ""); units.push({ number: a.number, line: k, ...s, chapter: ctx() }); continue; }
    if (!x.centered && !PART.test(x.text) && !CHAPTER.test(x.text)) continue;
    if (PART.test(x.text) && x.centered) {
      let t = [], j = k + 1; while (lines[j]?.centered && /^[^a-z]+$/.test(lines[j].text) && t.length < 3) t.push(lines[j++].text);
      part = `${x.text.replace(/[\[\]]/g, "").trim()} — ${t.join(" ").replace(/[\[\]]/g, "")}`.replace(/\s+—\s*$/, ""); chapter = ""; sub = ""; k = j - 1;
    } else if (CHAPTER.test(x.text) && x.centered) {
      let t = x.text, j = k + 1; if (/^CHAPTER\s+[IVX]+\.?$/.test(t)) { while (lines[j]?.centered && /^[^a-z]+$/.test(lines[j].text) && j < k + 3) t += ` ${lines[j++].text}`; }
      chapter = t.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim(); sub = ""; k = j - 1;
    } else if (isCrossHeading(x)) sub = x.text.replace(/[\[\]]/g, "").trim();
  }
  return units;
}

const ORD = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH"];
/** The twelve Schedules after the last Article: [{ number: "S7", n, title, text, pages, line }]. The text is the printed lines in order (tables are kept as lines, not as grids). */
export function scheduleUnits(lines, afterLine) {
  const heads = []; lines.forEach((l, i) => { const m = /^(?:THE\s+)?(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH) SCHEDULE\s*$/.exec(l.text.replace(/^\[|\]$/g, "")); if (m && i > afterLine) heads.push({ n: ORD.indexOf(m[1]) + 1, i }); });
  const app = lines.findIndex((l, i) => i > afterLine && /^APPENDIX I\b/i.test(l.text)); while (app > 0 && heads.length && heads.at(-1).i > app) heads.pop();   // the later "FIRST SCHEDULE" headings belong to an Appendix (an amending Act), not to the Constitution
  const end = app;
  return heads.map((h, k) => {
    const to = k + 1 < heads.length ? heads[k + 1].i : end > 0 ? end : lines.length, body = lines.slice(h.i + 1, to);
    const first = body.findIndex((l) => !l.centered || !/^[\[(].*[\])]$|^[^a-z]+$/.test(l.text));
    const titleLines = body.slice(0, Math.max(0, first)).map((l) => l.text), rest = body.slice(Math.max(0, first)).map((l) => l.text);
    // one paragraph per numbered entry ("1. Defence of India ..."), list or part heading; other lines continue the paragraph (a word broken at a hyphen is joined)
    const NEW = /^(\[?\s*\d{1,3}[A-Z]?\.\]?\s+\S|\[?(List|PART|Part)\s+[IVX]+|\(\w{1,4}\)\s)/, paras = [];
    for (const t of [...titleLines, ...rest].filter(Boolean)) { const prev = paras.at(-1); if (prev === undefined || (NEW.test(t) && /[.;:—\]”)]$/.test(prev))) paras.push(t); else paras[paras.length - 1] = /[a-z]-$/.test(prev) && /^[a-z]/.test(t) ? prev + t : `${prev} ${t}`; }
    const text = paras.map((x) => x.replace(/\s{2,}/g, " ").trim()).join("\n");
    return { number: `S${h.n}`, n: h.n, ok: true, heading: `${ORD[h.n - 1][0]}${ORD[h.n - 1].slice(1).toLowerCase()} Schedule`, title: titleLines.join(" "), text, pages: [lines[h.i].page, lines[to - 1].page], line: h.i };
  });
}
