// Understanding what the user typed in the Acts search box. PURE logic: no database, no styling. Used by src/lib/acts/searchStore.ts and tested in searchQuery.test.mjs.
export const MAX_Q = 200, MIN_Q = 2;

/** Well-known short names -> a title prefix that identifies the Act (matched case-insensitively against acts.title). Central Acts only. */
export const ACT_ALIASES = {
  "ni act": "the negotiable instruments act, 1881", "n i act": "the negotiable instruments act, 1881", "negotiable instruments act": "the negotiable instruments act, 1881",
  "contract act": "the indian contract act, 1872", "indian contract act": "the indian contract act, 1872",
  "ipc": "the indian penal code", "indian penal code": "the indian penal code",
  "crpc": "the code of criminal procedure, 1973", "cr pc": "the code of criminal procedure, 1973",
  "cpc": "the code of civil procedure, 1908", "civil procedure code": "the code of civil procedure, 1908",
  "bns": "the bharatiya nyaya sanhita", "bnss": "the bharatiya nagarik suraksha sanhita", "bsa": "the bharatiya sakshya adhiniyam",
  "evidence act": "the indian evidence act, 1872", "limitation act": "the limitation act, 1963",
  "arbitration act": "the arbitration and conciliation act, 1996", "companies act": "the companies act, 2013",
  "it act": "the information technology act, 2000", "transfer of property act": "the transfer of property act, 1882",
  "sale of goods act": "the sale of goods act, 1930", "partnership act": "the indian partnership act, 1932",
};

const STOP = new Set(["the", "of", "act", "code", "and", "in"]);
const SEC = String.raw`(?:section|sections|sec\.?|s\.?|§)`;
const NUM = String.raw`(\d{1,4}[A-Za-z]{0,2}(?:-[A-Za-z0-9]{1,2})?)`;
const clean = (s) => s.toLowerCase().replace(/[.,;:]/g, " ").replace(/\s+/g, " ").trim();
const looksLikeAct = (p) => { const c = clean(p); return !!ACT_ALIASES[c] || /\b(act|code|sanhita|adhiniyam|rules?)\b/.test(c) || c.split(" ").length >= 2; };

/** Validates the raw box content. Returns { q } or { error } (the API turns an error into HTTP 422). */
export function normalizeQuery(raw) {
  const q = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (q.length < MIN_Q) return { error: `Type at least ${MIN_Q} characters.` };
  if (q.length > MAX_Q) return { error: `The search is too long (${q.length} characters). Use at most ${MAX_Q}.` };
  return { q };
}

/** "138 NI Act", "section 10 contract act", "NI Act s. 138", "contract act section 10" -> { number, actPhrase } or null. */
export function parseSectionLookup(q) {
  const s = q.trim().replace(/\s+/g, " ");
  let m = new RegExp(String.raw`^(?:${SEC}\s*)?${NUM}\s+(?:of\s+(?:the\s+)?)?(.+)$`, "i").exec(s);
  if (m && looksLikeAct(m[2]) && !/^\d/.test(m[2])) return { number: m[1].toUpperCase(), actPhrase: m[2] };
  m = new RegExp(String.raw`^(.+?)[\s,]+(?:${SEC}\s*)${NUM}$`, "i").exec(s);
  if (m && looksLikeAct(m[1])) return { number: m[2].toUpperCase(), actPhrase: m[1] };
  m = new RegExp(String.raw`^(.+?\b(?:act|code|sanhita|adhiniyam))[\s,]+${NUM}$`, "i").exec(s);
  if (m) return { number: m[2].toUpperCase(), actPhrase: m[1] };
  m = new RegExp(String.raw`^(ni act|ipc|crpc|cpc|bns|bnss|bsa)\s+${NUM}$`, "i").exec(s);
  if (m) return { number: m[2].toUpperCase(), actPhrase: m[1] };
  return null;
}

/** An Act phrase -> how to find it: an exact title prefix (aliases) or the significant words that must all appear in the title. */
export function actMatcher(actPhrase) {
  const c = clean(actPhrase.replace(/^the\s+/i, ""));
  const alias = ACT_ALIASES[c] ?? ACT_ALIASES[c.replace(/\s+act$/, " act")];
  if (alias) return { titlePrefix: alias, words: [] };
  const words = c.split(" ").filter((w) => w && !STOP.has(w));
  return { titlePrefix: null, words };
}

export const hasDevanagari = (q) => /[ऀ-ॿ]/.test(q);
/** A query with no letters or digits at all (punctuation, symbols) cannot match anything. */
export const hasSearchableChars = (q) => /[\p{L}\p{N}]/u.test(q);
