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
  "constitution": "the constitution of india", "constitution of india": "the constitution of india", "coi": "the constitution of india",
  "limitation": "the limitation act, 1963", "stamp act": "the indian stamp act, 1899", "indian stamp act": "the indian stamp act, 1899", "c p c": "the code of civil procedure, 1908",
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

// Orders, Rules and Articles of the Schedules: "Order 39 Rule 1 CPC", "O.7 R.11", "O 37 CPC", "CPC Order 39 Rule 1-2", "Article 137 Limitation Act", "Art. 113 Limitation".
const CPC = String.raw`(?:c\.?\s?p\.?\s?c\.?|civil procedure code|code of civil procedure(?:,?\s*1908)?)`;
const ORD = String.raw`(?:orders?|o\.?)\s*(\d{1,3}[A-Za-z]?)`, RULE = String.raw`(?:rules?|rr?\.?)\s*(\d{1,3}[A-Za-z]?)(?:\s*(?:-|–|to|and|&)\s*(\d{1,3}[A-Za-z]?))?`;
const LIM = String.raw`(?:the\s+)?(limitation(?:\s+act)?(?:,?\s*1963)?|(?:the\s+)?(?:indian\s+)?stamp\s+act(?:,?\s*1899)?)`;
const ART = String.raw`(?:articles?|art\.?)\s*(\d{1,3}[A-Za-z]{0,2})`;
const upTo = (a, b) => { const n1 = /^(\d+)([A-Za-z]?)$/.exec(a), n2 = b && /^(\d+)([A-Za-z]?)$/.exec(b); if (!n2 || n1[2] || n2[2] || +n2[1] <= +n1[1] || +n2[1] - +n1[1] > 20) return [a.toUpperCase()]; return Array.from({ length: +n2[1] - +n1[1] + 1 }, (_, i) => String(+n1[1] + i)); };
export function parseScheduleLookup(q) {
  const s = q.trim().replace(/\s+/g, " ").replace(/[.,]+$/, "");
  const cpcWord = String.raw`(?:of\s+(?:the\s+)?)?(${CPC})`;
  let m = new RegExp(String.raw`^(?:${CPC}\s+)?${ORD}\s*[,]?\s*${RULE}(?:\s+${cpcWord})?$`, "i").exec(s);
  if (m) { const o = m[1].toUpperCase(), rs = upTo(m[2], m[3]); return { number: `O${o}R${rs[0]}`, numbers: rs.map((r) => `O${o}R${r}`), actPhrase: "cpc" }; }
  m = new RegExp(String.raw`^${RULE}\s+(?:of\s+)?${ORD}(?:\s+${cpcWord})?$`, "i").exec(s);
  if (m) { const o = m[3].toUpperCase(), rs = upTo(m[1], m[2]); return { number: `O${o}R${rs[0]}`, numbers: rs.map((r) => `O${o}R${r}`), actPhrase: "cpc" }; }
  m = new RegExp(String.raw`^(?:${CPC}\s+)?(?:orders?\s*(\d{1,3}[A-Za-z]?)(?:\s+${cpcWord})?|o\.?\s*(\d{1,3}[A-Za-z]?)\s+${cpcWord}|${CPC}\s+o\.?\s*(\d{1,3}[A-Za-z]?))$`, "i").exec(s);
  if (m) { const o = (m[1] ?? m[2] ?? m[3]).toUpperCase(); if (m[1] || m[2] || m[3]) return { number: `O${o}`, actPhrase: "cpc" }; }
  m = new RegExp(String.raw`^${ART}\s*(?:of\s+)?${LIM}$`, "i").exec(s);
  const m2 = m ? null : new RegExp(String.raw`^${LIM}\s*,?\s*${ART}$`, "i").exec(s);
  if (m || m2) { const art = m ? m[1] : m2[2], lim = m ? m[2] : m2[1]; return { number: `A${art.toUpperCase()}`, actPhrase: /stamp/i.test(lim) ? "indian stamp act" : "limitation act" }; }
  // The Constitution of India: "Article 21", "Art. 226 Constitution", "Article 21A of the Constitution", "Constitution Article 32", "Seventh Schedule" (a bare "Article N" means the Constitution)
  const CONST = String.raw`(?:the\s+)?constitution(?:\s+of\s+india)?`;
  m = new RegExp(String.raw`^${ART}\s*(?:of\s+)?(?:${CONST})?$`, "i").exec(s) ?? new RegExp(String.raw`^${CONST}\s*,?\s*${ART}$`, "i").exec(s);
  if (m) return { number: `A${m[1].toUpperCase()}`, actPhrase: "constitution of india" };
  if (new RegExp(String.raw`^(?:the\s+)?preamble(?:\s+(?:to|of)\s+${CONST})?$`, "i").test(s)) return { number: "PREAMBLE", actPhrase: "constitution of india" };
  m = new RegExp(String.raw`^appendix\s+(III|II|I|1|2|3)\s+(?:of\s+)?${CONST}$`, "i").exec(s) ?? new RegExp(String.raw`^${CONST}\s*,?\s*appendix\s+(III|II|I|1|2|3)$`, "i").exec(s);
  if (m) return { number: `APP${{ I: 1, II: 2, III: 3 }[m[1].toUpperCase()] ?? m[1]}`, actPhrase: "constitution of india" };
  m = new RegExp(String.raw`^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d{1,2}(?:st|nd|rd|th))\s+schedule(?:\s+(?:of\s+)?${CONST})?$`, "i").exec(s);
  if (m) { const n = SCHEDULE_NUMBERS[m[1].toLowerCase()] ?? parseInt(m[1], 10); if (n >= 1 && n <= 12) return { number: `S${n}`, actPhrase: "constitution of india" }; }
  return null;
}
const SCHEDULE_NUMBERS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };

/** "138 NI Act", "section 10 contract act", "NI Act s. 138", "contract act section 10" -> { number, actPhrase } or null. */
export function parseSectionLookup(q) {
  const sched = parseScheduleLookup(q);
  if (sched) return sched;
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
export function actMatcher(actPhrase, { noAlias = false } = {}) {   // noAlias: a state's copy is titled in its own way ("The INDIAN-PENAL-CODE-1860"), so its words are matched, not a title prefix
  const c = clean(actPhrase.replace(/^the\s+/i, ""));
  const alias = noAlias ? undefined : (ACT_ALIASES[c] ?? ACT_ALIASES[c.replace(/\s+act$/, " act")]);
  if (alias) return { titlePrefix: alias, words: [] };
  const words = c.split(" ").filter((w) => w && !STOP.has(w));
  return { titlePrefix: null, words };
}

export const hasDevanagari = (q) => /[ऀ-ॿ]/.test(q);
/** A query with no letters or digits at all (punctuation, symbols) cannot match anything. */
export const hasSearchableChars = (q) => /[\p{L}\p{N}]/u.test(q);
