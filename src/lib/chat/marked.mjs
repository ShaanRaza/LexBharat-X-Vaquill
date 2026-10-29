// Which paragraph of a cited section is "the marked page"? The one the answer's sentences that cite it share the most words with. PURE logic: no database, no network, no styling.
const STOP = new Set("shall which under that this with from have been their there other such than when where whether section sections act acts also into upon only more must may can not any all are was were has its for the and who whom whose each every about after before within without".split(" "));
const tokens = (s) => (String(s).toLowerCase().match(/[a-z]{4,}|\d+/g) ?? []).filter((w) => !STOP.has(w));
const CITE = /\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g;

/** The answer's sentences that cite source n, without their [n] marks. */
export function sentencesCiting(answer, n) {
  const out = [];
  for (const line of String(answer).split("\n")) for (const seg of line.split(/(?<=[.;:])\s+/)) {
    if ([...seg.matchAll(CITE)].some((m) => m[1].split(/[,;]/).map((x) => Number(x.trim())).includes(n))) out.push(seg.replace(CITE, "").replace(/\s+([.,;:])/g, "$1").replace(/\s+/g, " ").trim());
  }
  return out;
}

/** A section's text as readable paragraphs: markdown marks removed, one paragraph per line or blank-line block, empty ones dropped. */
export function paragraphsOf(body) {
  return String(body ?? "").replace(/\*\*/g, "").replace(/(^|\s)_([^_\n]+)_/g, "$1$2").replace(/^>\s?/gm, "").replace(/^#{1,6}\s+/gm, "").split(/\r?\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** { paragraphs, marked }: marked is the index of the paragraph that shares the most words with `sentences` (at least 2 words), or -1 when none clearly does. */
export function markParagraph(body, sentences) {
  const paragraphs = paragraphsOf(body), want = new Set(sentences.flatMap(tokens));
  let marked = -1, best = 1;
  paragraphs.forEach((p, i) => { const have = new Set(tokens(p)); let c = 0; for (const w of want) if (have.has(w)) c++; if (c > best) { best = c; marked = i; } });
  return { paragraphs, marked };
}
