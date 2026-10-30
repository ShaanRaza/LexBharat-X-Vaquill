// Query rewrite: one cheap model call turns the question into 2-3 search queries (legal terms, likely Act and section names). PURE logic: prompt, parsing and merging; no network.
import { rrf } from "../acts/fusion.mjs";

export const REWRITE_SYSTEM = `You turn a question about Indian law into search queries for a database of Indian Central and State Acts. Reply with JSON only: {"queries": [string, string, string]}.
- 2 to 4 queries, each under 120 characters.
- Query 1: the question restated with the legal terms an Act would use, for example "competency to contract age of majority minor agreement void".
- The other queries: the Acts and sections most likely to answer it, written like "Indian Contract Act section 11" or "Negotiable Instruments Act section 138 notice demand payment". Name an Act and section only if you are fairly sure; otherwise use legal terms.
- If the question is about an offence, a right or a procedure, make one of the queries about closely related provisions on the same subject in other forms or other Acts (for example the electronic-transfer equivalent of a cheque offence, or the penalty and cognizance sections).
- If the question touches MORE THAN ONE Act or legal issue (for example a contract AND a crime, a limitation period AND arbitration, a consumer complaint AND a real-estate law), write ONE query for EACH Act or issue, each naming the likely Act and section, and do not mix two Acts in one query. A question about a single Act keeps its 2 or 3 queries.
- If the question names a State or Union Territory, keep its name in the queries.
- Do not answer the question. Indian law only.`;

/** Added to the rewrite prompt when the statutory rewrite switch is on (chat-tuning.json): everyday words and Hinglish become the terms a statute uses, and the current criminal laws are named. */
export const STATUTORY_ADDENDUM = `
- Keep what the user wrote: every Act, section number and subject the question itself names gets its own query (a question about two things needs a query for each), written the way the user named it (for example "IPC 420" stays a query about IPC section 420).
- The question may be in everyday words or in Hinglish (Hindi written in English letters). Write the queries in English, in the words a statute uses, not the user's words: for example "cheque bounce" is "dishonour of cheque for insufficiency of funds", "FIR darj nahi" is "information in cognizable cases, officer refuses to record it", "dahej" is "dowry", "chori" is "theft".
- Prefer the CURRENT criminal laws: the Bharatiya Nyaya Sanhita (BNS, replaced the Indian Penal Code), the Bharatiya Nagarik Suraksha Sanhita (BNSS, replaced the Code of Criminal Procedure) and the Bharatiya Sakshya Adhiniyam (BSA, replaced the Indian Evidence Act). If the question names an old section (IPC 302, CrPC 438, Evidence Act 65B), make one query for the equivalent section of the new law, for example "Bharatiya Nyaya Sanhita section 103 punishment for murder", when you know it.
- If the question describes a situation and not a law, name the heading the provision would carry, for example "tenant default in payment of rent forfeiture determination of lease".`;

export function buildRewritePrompt({ question, history = [], docContext = "", statutory = false, hint = "" }) {
  const prev = [...history].reverse().find((m) => m.role === "user");
  return { system: statutory ? REWRITE_SYSTEM + STATUTORY_ADDENDUM : REWRITE_SYSTEM, messages: [{ role: "user", content: `${prev ? `Previous question in this chat: ${prev.content.slice(0, 300)}\n` : ""}${docContext ? `The user attached their own document; a relevant passage reads: ${docContext.slice(0, 400)}\nWrite the queries for the law that bears on that passage and the question.\n` : ""}${hint ? `${hint}\n` : ""}Question: ${question}` }] };
}

export const MAX_QUERIES = 4;
/** The model's JSON -> up to 4 clean queries (trimmed, at most 120 characters, no duplicates, none equal to the question itself). Unreadable output gives []. */
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
    if (out.length === MAX_QUERIES) break;
  }
  return out;
}

/** Merges ranked lists of section keys (one per query): sections found by several queries rise (reciprocal rank fusion). `first` keys (exact lookups named in the question) always come first. */
export function mergeRanked(lists, limit, first = []) {
  const out = [...new Set(first)];
  for (const k of rrf(lists.filter((l) => l.length))) { if (out.length >= limit) break; if (!out.includes(k)) out.push(k); }
  return out.slice(0, limit);
}

/** Hybrid merge: keyword results may BOOST a section the search by meaning already found (and the exact lookups), but they never outrank them, and at most `tail` sections found only by keywords are added at the end. */
export function mergeHybrid(semanticLists, keywordLists, limit, first = [], tail = 2) {
  const pool = new Set([...semanticLists.flat(), ...first]);
  const boost = keywordLists.map((l) => l.filter((k) => pool.has(k)));
  const only = [...new Set(keywordLists.flat().filter((k) => !pool.has(k)))].slice(0, tail);
  return [...mergeRanked([...semanticLists, ...boost], limit - only.length, first), ...only].slice(0, limit);
}
