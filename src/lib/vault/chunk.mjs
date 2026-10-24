// Splits document text into passages for search. PURE logic. A passage keeps the page it starts on and the clause heading it sits under ("5. Non-compete"), so an answer can cite "NDA.pdf, page 3, clause 5".
const CLAUSE_A = /^\s*(?:(?:clause|section|article)\s+)?(?:\d{1,3}(?:\.\d{1,3}){0,3}[.)]?|\([a-z]{1,3}\)|\([ivx]{1,5}\))(?:\s|$)/i, CLAUSE_B = /^[A-Z][A-Z .&-]{3,40}:?$/;
const CLAUSE = { test: (l) => CLAUSE_A.test(l) || CLAUSE_B.test(l.trim()) };
const HEADING = /^\s*((?:clause|section|article)\s+)?(\d{1,3}(?:\.\d{1,3}){0,3})[.)]?\s+(.{2,70})$/i;

/** Units of text: a unit starts at a blank line or at a numbered-clause line. pages: array of page texts (null pages are allowed). Returns [{ page, text, heading }] with heading = the latest "5. Title" seen. */
export function toUnits(pages) {
  const units = []; let heading = null;
  pages.forEach((txt, pi) => {
    let cur = null;
    const flush = () => { if (cur && cur.text.trim()) units.push(cur); cur = null; };
    for (const raw of String(txt ?? "").replace(/\r/g, "").split("\n")) {
      const line = raw.replace(/[ \t]+/g, " ").trim();
      if (!line) { flush(); continue; }
      const h = HEADING.exec(line);
      if (h && /^[A-Z0-9(“"']/.test(h[3])) heading = `${h[2]}${h[2].includes(".") ? "" : "."} ${h[3].replace(/[.:]\s*$/, "").slice(0, 50)}`;
      if (CLAUSE.test(line) && cur) flush();
      if (!cur) cur = { page: txt === null ? null : pi + 1, text: "", heading };
      cur.text += (cur.text ? " " : "") + line;
    }
    flush();
  });
  return units;
}

/** Packs units into passages of about `chars` characters (a long unit is cut at sentence ends or spaces, with `overlap` characters repeated). Returns [{ idx, page, label, body }]. */
export function chunkPages(pages, { chars = 1100, overlap = 150 } = {}) {
  const out = [];
  const add = (page, label, body) => { const b = body.replace(/\s+/g, " ").trim(); if (b) out.push({ idx: out.length, page, label: label ?? null, body: b }); };
  let acc = null;
  const flush = () => { if (acc) { add(acc.page, acc.last && acc.last !== acc.label ? (acc.label ? `${acc.label} to ${acc.last}` : `up to ${acc.last}`).slice(0, 110) : acc.label, acc.text); acc = null; } };
  for (const u of toUnits(pages)) {
    if (u.text.length > chars) {
      flush();
      let s = 0;
      while (s < u.text.length) {
        let e = Math.min(u.text.length, s + chars);
        if (e < u.text.length) { const cut = Math.max(u.text.lastIndexOf(". ", e), u.text.lastIndexOf("; ", e)); e = cut > s + chars * 0.5 ? cut + 1 : (u.text.lastIndexOf(" ", e) > s + chars * 0.5 ? u.text.lastIndexOf(" ", e) : e); }
        add(u.page, u.heading, u.text.slice(s, e));
        if (e >= u.text.length) break;
        s = Math.max(e - overlap, s + 1);
      }
      continue;
    }
    if (acc && acc.text.length + 1 + u.text.length > chars) flush();
    if (!acc) acc = { page: u.page, label: u.heading, last: u.heading, text: u.text }; else { acc.text += " " + u.text; if (u.heading) acc.last = u.heading; }
  }
  flush();
  return out;
}

/** Page number a character offset of the joined text falls on. starts: the offset where each page starts. */
export const pageAt = (starts, offset) => { let p = 1; for (let i = 0; i < starts.length; i++) if (starts[i] <= offset) p = i + 1; return p; };
