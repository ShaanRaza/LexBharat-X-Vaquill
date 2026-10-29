// Citation-number check. PURE logic. The model sometimes cites the right idea with the wrong number. For each sentence, a cited number whose source shares (almost) no content with the sentence
// is replaced by the source that does. Sentences are never reworded and a citation is never added where none was written; when no other source fits clearly, the citation is left alone.
const CITE_RE = /\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g;
const STOP = new Set("shall which under that this with from have been their there other such than when where whether section sections act acts also into upon only more must may can not any all are was were has its for the and who whom whose each every about after before within without".split(" "));
const tokens = (s) => new Set((String(s).toLowerCase().match(/[a-z]{4,}|\d+/g) ?? []).filter((w) => !STOP.has(w)));
const MIN_OTHER = 3, MARGIN = 3, MAX_OWN = 1;

/** sources: [{ n, actTitle, number, heading, text }]. Returns { text, swaps: [{ from, to, sentence }] }. */
export function verifyCitations(text, sources) {
  const bag = new Map(sources.map((s) => [s.n, tokens(`${s.actTitle} ${s.number ?? ""} ${s.heading ?? ""} ${s.text}`)]));
  const swaps = [];
  const fixed = text.split("\n").map((line) => line.split(/(?<=[.;:])\s+/).map((seg) => {
    const marks = [...seg.matchAll(CITE_RE)]; if (!marks.length) return seg;
    const words = tokens(seg.replace(CITE_RE, " ")); if (words.size < 4) return seg;
    const cited = new Set(marks.flatMap((m) => m[1].split(/[,;]/).map((x) => Number(x.trim()))));
    const score = (n) => { const b = bag.get(n); if (!b) return -1; let c = 0; for (const w of words) if (b.has(w)) c++; return c; };
    const map = new Map();
    for (const n of cited) {
      if (!bag.has(n) || score(n) > MAX_OWN) continue;
      let best = null, bs = 0; for (const s of sources) { if (s.n === n || cited.has(s.n)) continue; const sc = score(s.n); if (sc > bs) { best = s.n; bs = sc; } }
      if (best !== null && bs >= MIN_OTHER && bs >= score(n) + MARGIN) { map.set(n, best); swaps.push({ from: n, to: best, sentence: seg.replace(CITE_RE, "").trim().slice(0, 160) }); }
    }
    if (!map.size) return seg;
    return seg.replace(CITE_RE, (_, list) => `[${[...new Set(list.split(/[,;]/).map((x) => { const n = Number(x.trim()); return map.get(n) ?? n; }))].join(", ")}]`);
  }).join(" ")).join("\n");
  return { text: fixed, swaps };
}
