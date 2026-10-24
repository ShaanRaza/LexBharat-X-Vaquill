// Orders and Rules of the CPC First Schedule, Articles of the Limitation Act Schedule and Articles of Schedule I of the Indian Stamp Act, read out of the India Code PDFs like the sections (pdf-text.mjs,
// list-sections.mjs, extract-sections.mjs). Each Order, Rule and Article becomes one unit with a number like O39R1, O39 or A137 (the number the lookups use).
import { startAt } from "./list-sections.mjs";
import { cutSection } from "./extract-sections.mjs";

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export const romanToInt = (r) => [...r].reduce((t, c, i, a) => (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? t - ROMAN[c] : t + ROMAN[c]), 0);
const ORDER_HEAD = /^[*\[\s]*ORDER\s+([IVXLC]+)(?:-?([A-Z]{1,2}))?\s*\]?\s*$/;   // "*[ORDER XV" and "ORDER XV-A" carry stray marks
const END_CPC = /^(APPENDIX\b|THE (SECOND|THIRD|FOURTH|FIFTH) SCHEDULE)/;

/** A line's text with a space only where the printed letters have a gap (small-capital titles are printed as separate glyph runs). */
const gapJoin = (line) => line.items.reduce((o, it, k, a) => o + (k && (it.x - a[k - 1].xEnd > 0.2 || (/^[A-Z]$/.test(it.str) && a[k - 1].str.length > 1)) ? " " : "") + it.str, "").replace(/\s+/g, " ").trim() || line.text;

/** CPC First Schedule: [{ number, order, orderSuffix, title, rule, heading, text, line }] with kind "order" or "rule". */
export function cpcUnits(lines, lastSectionLine) {
  const start = lines.findIndex((l, i) => i > lastSectionLine && /^THE FIRST SCHEDULE\s*$/.test(l.text));
  if (start < 0) return [];
  let end = lines.findIndex((l, i) => i > start && END_CPC.test(l.text)); if (end < 0) end = lines.length;
  const units = []; let order = null, last = 0, lastSuf = "", inState = false, title = [], collecting = false;
  const flushOrder = () => { if (order && title.length) units.push({ kind: "order", number: `O${order.n}${order.suf}`, order: order.n, orderSuffix: order.suf, heading: title.join(" "), text: title.join(" "), line: order.line }); };
  for (let i = start + 1; i < end; i++) {
    const t = lines[i].text, oh = ORDER_HEAD.exec(t);
    if (oh) { flushOrder(); order = { n: romanToInt(oh[1]), suf: oh[2] ?? "", line: i }; title = []; last = 0; lastSuf = ""; inState = false; collecting = true; continue; }
    if (!order) continue;
    if (/^STATE AMENDMENTS?\b/i.test(t)) { inState = true; collecting = false; continue; }
    const st = startAt(lines, i);
    // a title continues on the next line only when it ends mid-phrase; otherwise the next centred line is the first cross-heading
    if (collecting && !st) { if (title.length < 3 && lines[i].centered !== false && (!title.length || /(?:\b(?:and|of|to|for|in|the|or)|[,\-—–])$/i.test(title[title.length - 1]))) title.push(gapJoin(lines[i])); else collecting = false; continue; }
    if (!st) continue;
    collecting = false;
    const higher = st.n > last || (st.n === last && st.suf > lastSuf);
    if (!higher || (inState && st.n === last) || st.n > last + 30) continue;
    units.push({ kind: "rule", number: `O${order.n}${order.suf}R${st.n}${st.suf}`, order: order.n, orderSuffix: order.suf, rule: `${st.n}${st.suf}`, line: i, startKind: st.kind }); last = st.n; lastSuf = st.suf; inState = false;
  }
  flushOrder();
  // cut every rule's text
  for (const u of units) if (u.kind === "rule") { const s = cutSection(lines, u.rule, u.line); Object.assign(u, s.ok ? { ok: true, heading: s.heading, text: s.text, repealed: !!s.repealed, pages: s.pages } : { ok: false, why: s.why }); } else u.ok = true;
  return units;
}

// ---------------- table schedules (Limitation Act, Stamp Act Schedule I)
/** Items of a line as columns: boundaries = x positions where column 2, 3 ... begin. Returns one text per column. */
const colsOf = (line, bounds) => { const cols = bounds.map(() => []).concat([[]]); for (const it of line.items) { let c = 0; while (c < bounds.length && it.x >= bounds[c]) c++; cols[c].push(it); } return cols.map((c) => c.sort((a, b) => a.x - b.x).reduce((o, i, k, a) => o + (k && i.x - a[k - 1].xEnd < 1.5 ? "" : k ? " " : "") + i.str, "").replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim()); };

/** Limitation Act Schedule: Articles 1.. with description, period and "time from which period begins to run". */
export function limitationUnits(lines) {
  const start = lines.findLastIndex((l) => /^THE SCHEDULE\s*$/.test(l.text)); if (start < 0) return [];
  const units = []; let division = "", part = "", cur = null;
  const B = [250, 345];
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].text;
    if (/^Description of suit\b/.test(t) || /^\(PERIODS OF LIMITATION\)|^\[See sections/.test(t)) continue;
    if (/^STATEMENT OF OBJECTS AND REASONS/i.test(t)) break;   // what follows the schedule in the PDF is the Bill's statement, not law
    if (/^(FIRST|SECOND|THIRD) DIVISION/.test(t)) { if (cur) units.push(cur); cur = null; division = t.replace(/\s+/g, " "); part = ""; continue; }
    if (/^PART [IVX]+\.?[—–-]/.test(t)) { if (cur) units.push(cur); cur = null; part = t.replace(/\s+/g, " "); continue; }
    const [c1, c2, c3] = colsOf(lines[i], B), m = /^(\d{1,3})([A-Z]?)\.\s*(.*)$/.exec(c1);
    if (m && (!cur || Number(m[1]) > cur.n || (Number(m[1]) === cur.n && m[2] > cur.suf))) {
      if (cur) units.push(cur);
      cur = { kind: "article", n: Number(m[1]), suf: m[2], number: `A${m[1]}${m[2]}`, division, part, desc: [m[3]], period: c2 ? [c2] : [], from: c3 ? [c3] : [], line: i };
    } else if (cur) { if (c1) cur.desc.push(c1); if (c2) cur.period.push(c2); if (c3) cur.from.push(c3); }
  }
  if (cur) units.push(cur);
  const join = (a) => a.reduce((x, y) => (x && /[a-z]-$/.test(x) ? x + y : x ? `${x} ${y}` : y), "").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/(\((?:[a-z]{1,3}|\d{1,3}|[ivx]+)\))(?=[A-Za-z])/g, "$1 ").trim();
  for (const u of units) { u.ok = true; u.heading = join(u.desc); u.description = join(u.desc); u.periodText = join(u.period); u.fromText = join(u.from);
    u.text = [`Description of suit: ${u.description}`, `Period of limitation: ${u.periodText}`, `Time from which period begins to run: ${u.fromText}`, ...(u.division ? [`${u.division}`] : []), ...(u.part ? [`${u.part}`] : [])].join("\n"); }
  return units;
}

/** Splits a line at x = bound into [left, right]; a text run that reaches across the bound (a full-width line) keeps everything after it on the left. */
const twoCols = (line, bound) => { let crossed = false; const L = [], R = []; for (const it of line.items) { if (it.x < bound) { L.push(it); if (it.xEnd > bound) crossed = true; } else (crossed ? L : R).push(it); } const j = (a) => a.reduce((o, it, k) => o + (k && it.x - a[k - 1].xEnd >= 1.5 ? " " : "") + it.str, "").replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim(); return [j(L), j(R)]; };

/** Indian Stamp Act Schedule I (the Central text as printed, with its old rates): Articles with the description and the proper stamp-duty column. */
export function stampUnits(lines, lastSectionLine) {
  const start = lines.findIndex((l, i) => i > lastSectionLine && /^SCHEDULE\s*(1|I)\s*$/.test(l.text)); if (start < 0) return [];
  let end = lines.findIndex((l, i) => i > start && (/^Amendment of Schedule/i.test(l.text) || /^STATE AMENDMENTS?\b/i.test(l.text) || /^SCHEDULE I-A/i.test(l.text))); if (end < 0) end = lines.length;
  const units = []; let cur = null;
  const B = [325], startRe = /^\[?\s*(\d{1,2})([A-Z]?)\.\s*(\*\*\*|[A-Z].*)$/;
  for (let i = start + 1; i < end; i++) {
    const t = lines[i].text;
    if (/^Description of Instrument\b|^\(?\s*See section 3|^STAMP-D|^S\s*TAMP|^SCHEDULE\s*(1|I)\s*$/i.test(t)) continue;
    const [c1, c2] = twoCols(lines[i], B[0]), m = startRe.exec(c1);
    const nn = m ? Number(m[1]) : 0, prevN = cur ? cur.n : 4;
    if (m && ((nn > prevN && nn <= prevN + 6) || (nn === prevN && m[2] > cur.suf))) {
      if (cur) units.push(cur);
      cur = { kind: "article", n: Number(m[1]), suf: m[2], number: `A${m[1]}${m[2]}`, desc: [m[3]], duty: c2 ? [c2] : [], omitted: m[3].startsWith("***"), first: i, lastLine: i };
    } else if (cur) { if (c1) cur.desc.push(c1); if (c2) cur.duty.push(c2); cur.lastLine = i; }
  }
  if (cur) units.push(cur);
  const tidyT = (a) => a.reduce((x, y) => (x && /[a-z]-$/.test(x) ? x + y : x ? `${x} ${y}` : y), "").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/(\((?:[a-z]{1,3}|\d{1,3}|[ivx]+)\))(?=[A-Za-z])/g, "$1 ").trim();
  for (const u of units) {
    u.ok = true; u.pages = [lines[u.first].page, lines[u.lastLine].page];
    const d = tidyT(u.desc); u.heading = d.replace(/^\*\*\*$/, "Omitted").split(/[,.—–]|\s{2,}/)[0].slice(0, 90).trim() || d.slice(0, 60);
    u.checkText = `${d} ${u.duty.join(" ")}`;
    u.text = `Description of instrument: ${d}\nProper stamp-duty: ${u.duty.map((x) => x.trim()).join(" ") || "—"}`;
  }
  return units;
}
