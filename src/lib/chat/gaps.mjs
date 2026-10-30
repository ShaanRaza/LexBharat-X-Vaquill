// Sections the library does not hold. PURE logic. When a question names a section we do not have (or hold only as scrambled text), or an answer mentions one, the answer says so plainly and points to the Act
// on India Code. It never states what such a section says: the prompt is told so, and nothing is answered from memory.
import { unitWord } from "../docs/docType.mjs";
import { findStatuteMentions } from "./citations.mjs";

const theAct = (title) => `the ${String(title).replace(/^the\s+/i, "")}`;

/** gap: { kind: "missing" | "unreliable" | "mentioned" | "nosuch", number, actTitle, max? }. One plain sentence. "nosuch": the number is above the Act's last section (max). */
export function gapSentence(g) {
  const what = `${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle)}`;
  if (g.kind === "nosuch") return `${what} doesn't exist: the Act's sections end at ${g.max}.`;
  if (g.kind === "unreliable") return `${what} is in our library, but its text came out scrambled from the source, so we cannot quote it.`;
  if (g.kind === "mentioned") return `The answer mentions ${what}, which isn't in our library yet.`;
  return `${what} isn't in our library yet.`;
}
/** What the screen shows next to the sentence: the same words plus where to read it. */
export const gapNotice = (g, url) => ({ kind: g.kind, text: gapSentence(g), url: url ?? null, label: `Read ${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle)} on India Code (search for this Act)` });

/** The opening lines of an answer when the question names sections we lack (kinds "missing" and "unreliable"). */
export const gapLead = (gaps) => gaps.filter((g) => g.kind !== "mentioned").map(gapSentence).join(" ");

/** Added to the system prompt when the question names sections we lack. */
export const missingAddendum = (gaps) => `

The user's question names ${gaps.filter((g) => g.kind !== "mentioned").map((g) => `${unitWord(g.number, { title: g.actTitle })} of ${theAct(g.actTitle)}`).join(", ")}, which the library does not hold, holds only as unreliable text, or which does not exist. The answer already begins by saying so. Extra rules:
- Do NOT say, summarize, paraphrase or guess what that section provides, not even if you are sure of it. Never answer from memory.
- Answer only the parts of the question that the numbered sources cover, and only from them. If nothing in the sources bears on the question, add nothing more.`;

/** "Section N of <Act>" in an answer where an Act is named but no retrieved source is that section: [{ number, act }] (at most 3). The caller checks whether the library holds it. */
export function unretrievedMentions(text, sources) {
  const out = [], seen = new Set();
  for (const m of findStatuteMentions(text, sources)) { if (m.source) continue; const k = `${m.number}|${m.act}`.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ number: m.number, act: m.act }); if (out.length === 3) break; }
  return out;
}
