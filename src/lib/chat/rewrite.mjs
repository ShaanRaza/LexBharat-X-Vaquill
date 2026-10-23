// Query rewrite: one cheap model call turns the question into 2-3 search queries (legal terms, likely Act and section names). PURE logic: prompt, parsing and merging; no network.
import { rrf } from "../acts/fusion.mjs";

export const REWRITE_SYSTEM = `You turn a question about Indian law into search queries for a database of Indian Central and State Acts. Reply with JSON only: {"queries": [string, string, string]}.
- 2 or 3 queries, each under 120 characters.
- Query 1: the question restated with the legal terms an Act would use, for example "competency to contract age of majority minor agreement void".
- The other queries: the Acts and sections most likely to answer it, written like "Indian Contract Act section 11" or "Negotiable Instruments Act section 138 notice demand payment". Name an Act and section only if you are fairly sure; otherwise use legal terms.
- If the question names a State or Union Territory, keep its name in the queries.
- Do not answer the question. Indian law only.`;

export function buildRewritePrompt({ question, history = [] }) {
  const prev = [...history].reverse().find((m) => m.role === "user");
  return { system: REWRITE_SYSTEM, messages: [{ role: "user", content: `${prev ? `Previous question in this chat: ${prev.content.slice(0, 300)}\n` : ""}Question: ${question}` }] };
}

/** The model's JSON -> up to 3 clean queries (trimmed, at most 120 characters, no duplicates, none equal to the question itself). Unreadable output gives []. */
export function parseRewrite(raw, question = "") {
  let j = null;
  try { j = JSON.parse(String(raw).replace(/^```(?:json)?\s*|\s*```$/g, "").trim()); } catch { const m = /\{[\s\S]*\}/.exec(String(raw)); if (m) { try { j = JSON.parse(m[0]); } catch { /* none */ } } }
  const list = Array.isArray(j?.queries) ? j.queries : [];
  const seen = new Set([question.trim().toLowerCase()]), out = [];
  for (const q of list) {
    if (typeof q !== "string") continue;
    const t = q.replace(/\s+/g, " ").trim().slice(0, 120);
    if (t.length < 3 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase()); out.push(t);
    if (out.length === 3) break;
  }
  return out;
}

/** Merges ranked lists of section keys (one per query): sections found by several queries rise (reciprocal rank fusion). `first` keys (exact lookups named in the question) always come first. */
export function mergeRanked(lists, limit, first = []) {
  const out = [...new Set(first)];
  for (const k of rrf(lists.filter((l) => l.length))) { if (out.length >= limit) break; if (!out.includes(k)) out.push(k); }
  return out.slice(0, limit);
}
