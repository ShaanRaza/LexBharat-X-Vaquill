// Supreme Court report-heading extraction: the FULL BENCH and the CASE NUMBER, from the opening text of the English report.
// Pure string parsing: no network, no dependencies. Plain .mjs so the export script, the unit tests (node --test) and the app can all import the same code.
// Honesty rule: a field is returned only when the text matches cleanly; every doubt returns null (the app then shows the dataset's own value or "not found").

// ---------------------------------------------------------------- shared helpers
/** Letters only, upper case, without a leading honorific: the comparison key for names. "H. R. Khanna", "H.R. KHANNA" and "DR. H.R. KHANNA" share a key. */
export const nameKey = (n) => n.toUpperCase().replace(/^(?:DR|MR|MRS|MS|SHRI|SMT|SIR)\.?\s+/, "").replace(/[^A-Z]/g, "");
/** "H. R. KHANNA" -> "H.R. KHANNA" (the dataset's own style). */
export const tidyName = (n) => n.replace(/(?<=\b[A-Z]\.) (?=[A-Z]\.)/g, "");

/** Bad-match guard (rule: a match covering more than 5% of the text means a runaway regex). The allowance grows with the number of names, because a genuine
 *  13-judge bench is already about 5% of its opening chunk. Logs with console.warn and returns false so the caller falls back to "no value". */
export function withinGuard(matchLength, textLength, names = 0, label = "match", caseId = "") {
  const allowed = Math.max(0.05 * textLength, names * 40 + 20);
  if (matchLength <= allowed) return true;
  console.warn(`[extract] ${caseId} ${label}: ${matchLength} of ${textLength} characters (${((100 * matchLength) / textLength).toFixed(1)}%) exceeds the guard; ignored`);
  return false;
}

// ---------------------------------------------------------------- full bench
// the closing bracket may be OCR'd as j, I, 1 or l, but only right after "J." / "JJ." (so a name such as "J B PARDIWALA" can never end a block early)
const BLOCK = /[\[(]\s*([^\[\]()]{6,500}?)(?:\s*[\])]|(?<=\bJ{1,2}\.)\s?[jI1l](?=[\s,.]))/g;
const BLOCK_END = /\bJ{1,2}\s*\.?\s*[,.]?\s*$|\bC\.?\s?J\.?\s?I?\.?\s*$/;                // the block must end in J. / JJ. / CJ. / CJI
const TAIL = /[,\s]*\b(?:C\.?\s?J\.?\s?I?|J{1,2})\s*\.?\s*$/;
const DESIGNATION = /^(?:C\.?\s?J\.?\s?I?\.?|J\.?|JJ\.?)$/i;                                // "CJI", "CJ.", "J.", "JJ." standing alone are titles, not names
const INITIALS = /^[A-Z]\.?$|^(?:[A-Z]\.){2,}[A-Z]?\.?$/;
const CAPS = /^[A-Z][A-Z'’-]+\.?$/, TITLE = /^[A-Z][a-z'’-]+\.?$/, HONORIFIC = /^(?:DR|Dr|SHRI|Smt|MR|MRS|MS)\.?$/;

/** Two OCR repairs, each confirmed later by the vocabulary check: a stray dot inside a word ("PALEK.AR") and the initial K read as "IC" ("IC K. MATHEW"). */
export function cleanName(p) {
  let s = p.replace(/\s+/g, " ").trim();
  // a title glued to the name by a space rather than a comma: "V.N. KHARE CJ." -> "V.N. KHARE"; "CJI ANDPAMIDIGHANTAM SRI NARASIMHA" keeps its (rejected) glue
  s = s.replace(/\s+(?:C\.?\s?J\.?\s?I?\.?|JJ?\.?)$/, "").replace(/^(?:C\.?\s?J\.?\s?I?\.?)\s+(?=\S)/, "");
  if (/[A-Za-z]{3,}\.[A-Za-z]{2,}/.test(s)) s = s.replace(/(?<=[A-Za-z])\.(?=[A-Za-z]{2})/g, "");
  return s.replace(/\bIC\.?(?=\s)/g, "K.");
}
const NOT_NAMES = new Set(["ACTING", "CHIEF", "JUSTICE", "JUDGE", "HONBLE", "OF", "THE", "AND"]);
/** OCR glues two judges into one "name" around the word AND ("ANDHRISHIKESH", "WADHWAAND", "SINHAANDMARKANDEYKATJU"). Real names that contain AND (CHANDRACHUD, BHANDARI,
 *  MARKANDEY, ANAND) do not start with it, end with it, or have 4+ letters on both sides of it. */
const gluedAnd = (w) => /^AND[A-Z]/i.test(w) || (w.length >= 6 && /AND\.?$/i.test(w) && !/^ANAND\.?$/i.test(w)) || /[A-Za-z]{4,}AND[A-Za-z]{4,}/i.test(w);
/** A name is capitals or title case, not a mix; initials are neutral; 1 to 5 words; no glued AND, no title words. "FAZAL Au" (OCR for Ali) fails. */
export function looksLikeName(n) {
  const ws = n.split(" ");
  if (ws.length < 1 || ws.length > 5) return false;
  const styles = new Set(); let real = 0;
  for (const w of ws) {
    if (NOT_NAMES.has(w.toUpperCase().replace(/[^A-Z]/g, "")) || gluedAnd(w)) return false;
    if (INITIALS.test(w) || HONORIFIC.test(w)) continue;
    if (CAPS.test(w)) styles.add("c"); else if (TITLE.test(w)) styles.add("t"); else return false;
    real++;
  }
  return real >= 1 && styles.size === 1;
}
/** Splits a bench string into names. Titles standing alone (J., JJ., CJ., CJI) are dropped, except that a title directly after another title (or first) is really an initial
 *  whose full stop was read as a comma: "C.J., J, C. SHAH" is J.C. SHAH, not C. SHAH. */
function splitNames(body) {
  const parts = body.split(/\s*,\s*|\s+(?:AND|and)\s+|\s+&\s+/).map((p) => p.replace(/^[\s,]+|[\s,]+$/g, "")).filter(Boolean);
  const out = []; let prevTitle = true, initial = "";
  for (const p of parts) {
    if (DESIGNATION.test(p)) {
      if (prevTitle && /^J\.?$/i.test(p)) { initial = "J. "; continue; }  // a second title in a row, or one before any name: an initial J
      prevTitle = true; continue;
    }
    out.push(cleanName(initial + p)); initial = ""; prevTitle = false;
  }
  return out;
}
/** The names printed in the first bracketed block that ends in J./JJ./C.J., e.g. "[A and B, JJ.]", "(A, B and C, JJ.)", "[A, CJI and B, JJ.]".
 *  Returns { names, span } or null when there is no such block or any name is not shaped like a person's name. Names are as printed (cleaned), not yet verified. */
export function printedBench(text, caseId = "") {
  const head = text.slice(0, 1800); BLOCK.lastIndex = 0; let m;
  while ((m = BLOCK.exec(head))) {
    const raw = m[1].trim();
    if (!BLOCK_END.test(raw)) continue;
    const body = raw.replace(TAIL, "").replace(/\*/g, "").replace(/^[\s,.]+|[\s,.]+$/g, "")
      .replace(/\b(AND|and)["'’`~]+(?=[A-Za-z])/g, "$1 ")      // AND"M.M. PUNCHHI: stray quote between the words
      .replace(/\b(AND|and)(?=[A-Z]\.)/g, "$1 ");              // ANDV. RAMASUBRAMANIAN: AND glued to an initial (AND glued to a full word stays rejected)
    const names = splitNames(body);
    if (!names.length || !names.every(looksLikeName)) return null;
    return withinGuard(m[0].length, text.length, names.length, "bench", caseId) ? { names, span: m[0].length } : null;
  }
  return null; // the first such block is the bench; if it is not clean, nothing is shown
}

/** True when two name keys differ by an OCR-sized edit: one letter for short keys, two for keys of 10+ letters (LALIT / LAUT). */
const nearVariant = (a, b) => {
  const max = Math.min(a.length, b.length) >= 10 ? 2 : 1;
  if (a === b || Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= max;
};
/** Which spellings can be trusted? Names in the dataset's own judge list (`known`: key -> spelling), plus the DOMINANT spelling in the reports: printed on at least
 *  `minBenches` different benches and not a near variant (one letter, two for long names) of a spelling at least five times as common (that is an OCR slip: PATTANAJK for PATTANAIK, LAUT for LALIT).
 *  `printedLists` is an array of name arrays, one per case. Returns Map(key -> display spelling). */
export function buildVocabulary(printedLists, known = new Map(), minBenches = 10) {
  const seen = new Map();
  for (const names of printedLists) for (const n of names || []) { const k = nameKey(n); if (!seen.has(k)) seen.set(k, new Map()); const c = seen.get(k); c.set(n, (c.get(n) ?? 0) + 1); }
  const freq = new Map([...seen].map(([k, c]) => [k, [...c.values()].reduce((a, b) => a + b, 0)]));
  const keys = [...freq.keys()], byPrefix = new Map();
  for (const k of keys) { const p = k.slice(0, 2); (byPrefix.get(p) ?? byPrefix.set(p, []).get(p)).push(k); }
  const vocab = new Map(known);
  for (const [k, n] of freq) {
    if (n < minBenches || vocab.has(k)) continue;
    if ((byPrefix.get(k.slice(0, 2)) ?? []).every((o) => !nearVariant(k, o) || freq.get(o) * 5 <= n)) vocab.set(k, [...seen.get(k)].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return new Map([...vocab].map(([k, v]) => [k, tidyName(v)]));
}
/** A printed name that is not in the vocabulary but is an OCR-sized edit of exactly ONE vocabulary name (keys of 10+ letters only, so "M.R. SHAH" and "M.B. SHAH" are never
 *  confused) is read as that name: H.L. DATIU -> H.L. DATTU, LAUT MOHAN SHARMA -> LALIT MOHAN SHARMA. Returns the display spelling or undefined. */
function repair(key, vocab) {
  if (key.length < 10) return undefined;
  const hits = [...vocab.keys()].filter((k) => k.length >= 10 && nearVariant(key, k));
  return hits.length === 1 ? vocab.get(hits[0]) : undefined;
}
/** "First initial(s) + last name token": B.R. Gavai, BHUSHAN RAMKRISHNA GAVAI and "DR. B. R. GAVAI" all give { surname: GAVAI, initials: BR }. Case, dots and honorifics do not matter. */
function initialsSurname(name) {
  const t = name.toUpperCase().replace(/^(?:DR|MR|MRS|MS|SHRI|SMT|SIR)\.?\s+/, "").replace(/\./g, " ").split(/\s+/).filter(Boolean);
  const surname = t.length ? t[t.length - 1] : "", initials = t.slice(0, -1).map((w) => w[0]).join("");
  return { surname, initials };
}
/** Same judge? The surname must match, and the first initial; a second initial must match too when both names give one ("M.R. SHAH" is not "M.B. SHAH"). */
export function sameJudge(a, b) {
  const x = initialsSurname(a), y = initialsSurname(b);
  if (!x.surname || x.surname !== y.surname) return false;
  const n = Math.min(x.initials.length, y.initials.length, 2);
  return n >= 1 ? x.initials.slice(0, n) === y.initials.slice(0, n) : x.initials === y.initials;
}

/** The verified bench (display spellings) or null. Every name must be in the vocabulary (or repair to exactly one vocabulary name), none repeated, and the dataset's authoring
 *  field must agree: at least ONE of its names must be on the bench, compared by initials and surname (the dataset spells out first names the report abbreviates). */
export function verifyBench(names, vocab, authoring = []) {
  if (!names?.length) return null;
  const out = names.map((n) => vocab.get(nameKey(n)) ?? repair(nameKey(n), vocab));
  if (out.some((o) => !o) || new Set(out).size !== out.length) return null;
  return !authoring.length || authoring.some((a) => out.some((o) => sameJudge(a, o))) ? out : null;
}

// ---------------------------------------------------------------- case number
const KIND = String.raw`(?:(?:Criminal|Civil|Crl\.?|Cr\.?)\s+Appeals?(?:\s*\((?:Civil|Criminal|Crl\.?|C)\))?` +
  String.raw`|(?:Writ|Special\s+Leave|Transfer|Review|Contempt|Curative|Arbitration|Election|Original|Miscellaneous)\s+Petitions?(?:\s*\((?:Civil|Criminal|Crl\.?|C)\))?` +
  String.raw`|SLP(?:\s*\((?:Civil|Criminal|Crl\.?|C)\))?|Transferred\s+Cases?(?:\s*\((?:Civil|Criminal|Crl\.?|C)\))?|Original\s+Suit)`;
const NUMS = String.raw`\d{1,6}(?:\s*[-–]\s*\d{1,6})?(?:\s*(?:,|and|&)\s*\d{1,6}(?:\s*[-–]\s*\d{1,6})?)*`;
const ITEM = String.raw`(${KIND})\s*(No(?:s|\(s\))?)\.?\s*(${NUMS})\s*(?:/|of)\s*(\d{4})`;   // No. / Nos. / No(s).
const WHOLE = new RegExp(String.raw`^${ITEM}(?:\s*(?:,|and|&|;)\s*${ITEM})*$`, "i");
const EACH = new RegExp(ITEM, "gi");
const PAREN = /[\[(]\s*((?:[^\[\]()]|\([^()]{1,12}\)){8,220}?)\s*[\])]/g;   // one level of nested brackets is allowed: "(Special Leave Petition (Crl.) No. 5 of 2019)"

const titleKind = (k) => k.replace(/\s+/g, " ").replace(/\b([a-z])([a-z]*)/gi, (_, a, b) => (/^(?:SLP|C|Crl|Cr)$/i.test(a + b) ? (a + b).replace(/^slp$/i, "SLP").replace(/^c$/i, "C") : a.toUpperCase() + b.toLowerCase()));
/** "(Criminal Appeal No. 512 of 2020)" -> "Criminal Appeal No. 512 of 2020"; "(Crl. Appeal Nos. 1234-1235 of 2016)" -> "Crl. Appeal Nos. 1234-1235 of 2016".
 *  Several numbers in one heading are kept together as one string. Only the parenthesised or bracketed form counts; a case cannot be filed after it was decided. */
export function parseCaseNumber(text, decidedYear, caseId = "") {
  const head = text.slice(0, 1500); PAREN.lastIndex = 0; let m;
  while ((m = PAREN.exec(head))) {
    const inner = m[1].trim();
    if (!/appeal|petition|slp|transferred|suit/i.test(inner)) continue;
    if (!WHOLE.test(inner)) return null;          // a bracket about an appeal or petition that is not purely case numbers: do not guess
    const items = []; EACH.lastIndex = 0; let e;
    while ((e = EACH.exec(inner))) {
      const [, kind, no, nums, yr] = e, year = Number(yr);
      if (year < 1900 || year > decidedYear) return null;
      const plural = /^nos$/i.test(no) || /[-–,&]|and/i.test(nums);   // "No(s)." with one number is a single case
      items.push(`${titleKind(kind)} ${plural ? "Nos." : "No."} ${nums.replace(/\s*([-–])\s*/g, "$1").replace(/\s+/g, " ")} of ${year}`);
    }
    return items.length && withinGuard(m[0].length, text.length, items.length, "case number", caseId) ? items.join(" and ") : null;
  }
  return null;
}
