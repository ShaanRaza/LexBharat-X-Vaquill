// What Desk's one box means: a question (opens Ask), a citation (opens the law page), a case name (opens the judgment) or anything else (searches). When it is not clear, it searches: Search is the safe
// default, and the box always says what Enter will do. PURE logic (no styling, no network); the citation rules are the same as Quick-find's (src/lib/quickfind/rank.mjs).
import { parseQuick } from "../quickfind/rank.mjs";
import { looksLikeCaseName, looksLikeCitation } from "./quickfind.mjs";

const QUESTION_WORDS = new Set(["what", "whats", "how", "can", "could", "does", "do", "did", "is", "are", "was", "were", "when", "where", "who", "which", "why", "should", "may", "will", "would", "explain", "tell"]);
export const norm = (q) => String(q ?? "").replace(/\s+/g, " ").trim();

/** { kind: "empty" | "law" | "case" | "ask" | "search" } for what was typed. A question mark, a question word at the start, or six words or more mean a question; one to five plain words search. */
export function classifyDesk(q, cfg) {
  const s = norm(q); if (!s) return { kind: "empty" };
  if (parseQuick(s, cfg).kind !== "text" || looksLikeCitation(s)) return { kind: "law" };
  if (looksLikeCaseName(s)) return { kind: "case" };
  const words = s.split(" ");
  if (/\?$/.test(s) || QUESTION_WORDS.has(words[0].toLowerCase().replace(/[^a-z]/g, "")) || words.length >= 6) return { kind: "ask" };
  return { kind: "search" };
}

/** The sentence under the box. `target` is what a law or case lookup found ({ title }), or null while looking or when nothing matched. */
export function deskHint(kind, q, target, cfg) {
  const s = norm(q);
  switch (kind) {
    case "empty": return cfg.emptyHint;
    case "ask": return "Enter opens Ask with your question.";
    case "law": return target ? `Enter opens ${target.title}.` : "Enter opens the law page, or searches if there is no match.";
    case "case": return target ? `Enter opens the judgment: ${target.title}.` : `Enter searches the judgments for “${s}”.`;
    default: return `Enter searches the Acts for “${s}”. Not what you meant? Write it as a question to use Ask.`;
  }
}
