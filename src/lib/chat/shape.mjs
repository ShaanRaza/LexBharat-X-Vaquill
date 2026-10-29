// Shaping an answer without another model call. PURE logic. (1) A hedge before the answer ("Based on the sources provided, ...", "I couldn't find X. However, ...") moves out of the first sentence: the answer comes first,
// a real gap is said once at the end. (2) "Related provisions" keep only the bullets whose cited section really applies to the question. (3) A citation repeated inside one sentence is shown once.
import { contentTokens, lexicalBoost } from "../acts/searchBoost.mjs";

const SENT = /(?<=[.!?])\s+/;
const HEDGE_PREFIX = /^\s*(?:based on|according to|from|using|in view of)\s+(?:the\s+)?(?:sources?|information|documents?|texts?|sections?|provisions?|acts?)(?:\s+(?:provided|given|available|found|retrieved|searched|above|below))*\s*[,:]\s*/i;
const SOFT_OPENER = /^\s*(?:it (?:appears|seems|looks like)(?: that)?|it would appear(?: that)?|generally(?: speaking)?|in general)\s*,?\s+/i;
export const NOT_FOUND_FIRST = /^\s*(?:i\s+(?:could\s*not|couldn[’']t|cannot|can[’']t|did not|didn[’']t)\s+find|there is no (?:direct|specific|relevant)|the sources? (?:do|does) not (?:contain|mention|state|specify|cover))/i;
const upFirst = (s) => s.replace(/^\s*([a-z])/, (m, c) => c.toUpperCase());

/** The text of the first sentence is a hedge or a "could not find" before the answer: { kind } or null. */
export function openingHedge(text) {
  const t = String(text).trim(), first = t.split(SENT)[0] ?? "";
  if (HEDGE_PREFIX.test(t) || SOFT_OPENER.test(t)) return { kind: "preamble" };
  if (NOT_FOUND_FIRST.test(first) && /\[\d/.test(t.slice(first.length))) return { kind: "not-found-then-answer", sentence: first.trim() };
  return null;
}

/** The answer first: a hedging preamble is dropped; "I couldn't find X. <the answer>" becomes "<the answer>" followed, at the end, by the sentence about what was not found. */
export function answerFirst(text) {
  let t = String(text).trim();
  const h = openingHedge(t); if (!h) return t;
  if (h.kind === "preamble") return upFirst(t.replace(HEDGE_PREFIX, "").replace(SOFT_OPENER, "")).trim();
  const rest = t.slice(t.indexOf(h.sentence) + h.sentence.length).replace(/^\s*(?:however|but|that said|nevertheless)\s*,?\s*/i, "").trim();
  return `${upFirst(rest)}\n\n${h.sentence}`.trim();
}

/** Drops the bullets of the "Related provisions:" list that do not apply: a bullet stays when its cited section shares enough words with the question (heading and opening) OR its text points at a section the answer itself
 *  relies on ("... punishable under section 138"). sources [{ n, number, heading, text }]; `question` is the question (with its statutory words added). A bullet that cites no source, or one we cannot read, is kept
 *  (never guess). The line itself goes when no bullet is left. */
export function relatedOnlyIfApplicable(text, sources, question, { min = 0.34 } = {}) {
  const lines = String(text).split("\n"), at = lines.findIndex((l) => /^\s*related provisions\s*:/i.test(l));
  if (at < 0) return text;
  const tokens = contentTokens(question), by = new Map(sources.map((s) => [s.n, s])), keep = [];
  const mainNumbers = new Set([...lines.slice(0, at).join("\n").matchAll(/\[(\d{1,2})\]/g)].map((m) => by.get(Number(m[1]))?.number).filter(Boolean).map((x) => String(x).toUpperCase()));   // the sections the answer itself rests on
  let end = at + 1; while (end < lines.length && /^\s*[-*•]\s+/.test(lines[end])) end++;
  for (const l of lines.slice(at + 1, end)) {
    const nums = [...l.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])).filter((n) => by.has(n));
    const ok = !nums.length || nums.some((n) => { const s = by.get(n); return !s.text || lexicalBoost(tokens, s.heading ?? "", String(s.text).slice(0, 700)) >= 1 + 0.35 * min || [...mainNumbers].some((m) => new RegExp(`\\b(?:sections?|s\\.)\\s*${m}\\b`, "i").test(String(s.text))); });
    if (ok) keep.push(l);
  }
  return [...lines.slice(0, at), ...(keep.length ? [lines[at], ...keep] : []), ...lines.slice(end)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** "[1][1]" and "... [1] ... [1]" in one sentence or bullet show the citation once (the first); other numbers stay. */
export function dedupeCitations(text) {
  return String(text).split("\n").map((line) => line.split(/(?<=[.;:])\s+/).map((seg) => {
    const seen = new Set();
    return seg.replace(/\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g, (m, list) => {
      const nums = list.split(/[,;]/).map((x) => Number(x.trim())).filter((n) => !seen.has(n)); nums.forEach((n) => seen.add(n));
      return nums.length ? `[${nums.join(", ")}]` : "";
    }).replace(/[ \t]+([.,;:])/g, "$1").replace(/ {2,}/g, " ");
  }).join(" ")).join("\n");
}
