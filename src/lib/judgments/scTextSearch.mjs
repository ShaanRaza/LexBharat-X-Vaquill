// Pure helpers for searching inside judgment text. No database, no network, no styling.
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ");

/** True when the phrase occurs in the text (case and spacing ignored). */
export const phraseIn = (text, phrase) => norm(text).includes(norm(phrase).trim());

/** How many times the terms occur in the text in all, and per 10,000 characters (so a long judgment does not win only by length). terms: words or phrases. */
export function termCounts(text, terms) {
  const t = norm(text);
  let count = 0;
  for (const w of terms) { const x = norm(w).trim(); if (!x) continue; let at = 0; while ((at = t.indexOf(x, at)) >= 0) { count++; at += x.length; } }
  return { count, perTenK: t.length ? (count * 10000) / t.length : 0 };
}

/** The chunk where the first term occurs and ~300 characters around it, with the matched words wrapped in the private-use markers (U+E000 / U+E001) the UI turns into highlights. */
export function snippetAround(chunks, terms, open = "", close = "") {
  const ts = terms.map((w) => norm(w).trim()).filter(Boolean);
  for (const c of chunks) {
    const low = c.t.toLowerCase();
    const at = Math.min(...ts.map((w) => low.indexOf(w)).filter((i) => i >= 0), Infinity);
    if (at === Infinity) continue;
    let s = c.t.slice(Math.max(0, at - 120), at + 280).replace(/\s+/g, " ");
    for (const w of ts) s = s.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `${open}${m}${close}`);
    return { chunk: c.i, page: c.ps ?? null, text: (Math.max(0, at - 120) > 0 ? "… " : "") + s + " …" };
  }
  return { chunk: chunks[0]?.i ?? 0, page: chunks[0]?.ps ?? null, text: (chunks[0]?.t ?? "").slice(0, 300) };
}
