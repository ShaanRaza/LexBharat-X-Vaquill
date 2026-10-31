// Sections the library does not hold. PURE logic. When a question names a section we do not have (or hold only as scrambled text), or an answer mentions one, the answer says so plainly and points to the Act
// on India Code. It never states what such a section says: the prompt is told so, and nothing is answered from memory.
import { unitWord, shortActName } from "../docs/docType.mjs";
import { findStatuteMentions } from "./citations.mjs";

const stateLabel = (slug) => String(slug ?? "").split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
const theAct = (title, state) => (state ? `the ${stateLabel(state)} version of the ${shortActName(title)}` : `the ${shortActName(title)}`);   // the short name in sentences; the full title goes in a hover text (gapNotice.actTitle)

/** gap: { kind: "missing" | "unreliable" | "mentioned" | "nosuch", number, actTitle, max? }. One plain sentence. "nosuch": the number is above the Act's last section (max). */
export function gapSentence(g) {
  const what = `${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle, g.state)}`;
  if (g.kind === "nosuch") return `${what} doesn't exist: the Act's sections end at ${g.max}.`;
  if (g.kind === "unreliable") return `${what} is in our library, but its text is not usable (it came out scrambled from the source, or is only a list of section headings), so we cannot quote it.`;
  if (g.kind === "mentioned") return `The answer mentions ${what}, which isn't in our library yet.`;
  return `${what} isn't in our library yet.`;
}
/** What the screen shows next to the sentence: the same words plus where to read it. */
export const gapNotice = (g, url) => ({ kind: g.kind, text: gapSentence(g), url: url ?? null, actTitle: String(g.actTitle ?? ""), label: `Read ${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle, g.state)} on India Code (search for this Act)` });

/** One gap per section: the same section reached by two lookups, or named by the question and again by the answer, is said once and linked once. */
export const gapKey = (g) => `${shortActName(g.actTitle).toLowerCase()}|${g.state ?? ""}|${String(g.number).toUpperCase()}`;
export const uniqueGaps = (gaps) => { const seen = new Set(); return gaps.filter((g) => !seen.has(gapKey(g)) && !!seen.add(gapKey(g))); };

/** The opening of an answer when the question names sections we lack (kinds "missing", "unreliable", "nosuch"): one short sentence per section, nothing else. */
export const gapLead = (gaps) => uniqueGaps(gaps).filter((g) => g.kind !== "mentioned").map(gapSentence).join(" ");

/** The model's own words after the opening sentence must not say it all again: drop any sentence that says the section is not held / was not found / points to India Code. Paragraph 1 (the opening) is kept. */
const REPEAT = /\b(?:isn'?t|is not|aren'?t|are not|not|cannot be|can'?t be)\b[^.?!\n]{0,40}\b(?:in|from) (?:our|the) (?:library|source data|data)\b|\bcould(?:n'?t| not) find\b[^.?!\n]{0,80}\b(?:section|provision|text)\b|\bIndia ?Code\b|indiacode\.gov\.in|\bnot (?:been )?(?:included|available) in (?:our|the) (?:library|database)\b/i;
export function dropGapRepeats(text, gaps) {
  if (!gaps.some((g) => g.kind !== "mentioned" && g.kind !== "nosuch")) return text;
  const [first, ...rest] = String(text).split(/\n{2,}/);
  const kept = rest.map((p) => p.split(/(?<=[.?!])\s+/).filter((sentence) => !REPEAT.test(sentence)).join(" ").trim()).filter(Boolean);
  return [first, ...kept].join("\n\n");
}

/** Added to the system prompt when the question names sections we lack. */
export const missingAddendum = (gaps) => `

The user's question names ${uniqueGaps(gaps).filter((g) => g.kind !== "mentioned").map((g) => `${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle, g.state)}`).join(", ")}, which the library does not hold, holds only as unreliable text, or which does not exist. The answer already begins by saying so. Extra rules:
- Do NOT say, summarize, paraphrase or guess what that section provides, not even if you are sure of it. Never answer from memory.
- Do not say again that a section is missing, not found, or not in the library, and do not mention India Code or give any link: the answer already says so once and links it.
- Answer only the parts of the question that the numbered sources cover, and only from them. If nothing in the sources bears on the question, add nothing more.`;

/** "Section N of <Act>" in an answer where an Act is named but no retrieved source is that section: [{ number, act }] (at most 3). The caller checks whether the library holds it. */
export function unretrievedMentions(text, sources) {
  const out = [], seen = new Set();
  for (const m of findStatuteMentions(text, sources)) { if (m.source) continue; const k = `${m.number}|${m.act}`.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ number: m.number, act: m.act }); if (out.length === 3) break; }
  return out;
}

// ---- sections the question names that the library DOES hold (any copy, a state's included): the answer says so and answers from them
/** held: [{ n, number, actTitle, state }] -> "Section 34 of the Madhya Pradesh version of the Indian Penal Code [1]". */
const heldWhat = (h) => `${unitWord(h.number, { title: h.actTitle })} of ${theAct(h.actTitle, h.state)}`;
export const heldAddendum = (held) => held.length ? `

The user's question names ${held.map((h) => `${heldWhat(h)} (source [${h.n}])`).join(", ")}. It IS in the numbered sources. Extra rules:
- Answer from that source: say what it provides, cite it, and say which Act it is from${held.some((h) => h.state) ? ", including the State when it is a State's version (for example \"the Madhya Pradesh version of the Indian Penal Code\")" : ""}.
- Never say it was not found, is not available or is not in the library, and never begin with "I couldn't find".` : "";

const NOT_FOUND_CLAIM = /\b(?:couldn'?t|could not|cannot|can'?t|unable to) find\b|\bnot (?:found|available|in our library|in the library|held)\b|\b(?:isn'?t|is not|aren'?t|are not) (?:in|held in) (?:our|the) library\b/i;
/** When the section the question names IS held, a sentence that says it was not found is wrong: dropped. If nothing is left, one plain sentence says where it is. */
export function dropNotFoundClaims(text, held) {
  if (!held.length) return text;
  const kept = String(text).split(/\n{2,}/).map((p) => p.split(/(?<=[.?!])\s+/).filter((s) => !NOT_FOUND_CLAIM.test(s)).join(" ").trim()).filter(Boolean).join("\n\n");
  return kept || `${held.map((h) => `${heldWhat(h)} is in our library [${h.n}].`).join(" ")}`;
}
