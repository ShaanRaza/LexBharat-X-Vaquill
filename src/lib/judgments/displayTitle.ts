// A case title made fit to show: the TypeScript port of core/display_title.py in LexBharat-from-scratch (decisions A224 to A226, PR #217, merge 543e4ff).
// High Courts: it cuts the registration prefix, "None", a father's or husband's name, an age, an address and an occupation, and returns null when something
// sensitive is left (a judge, an advocate, a minor or guardian, a prisoner/police/employee number, a PIN or any 6+ digit run, mojibake, no party, too long).
// null means "show the case number instead", never an empty heading. Supreme Court: kept as recorded (spaces and a stray "versus VS." tail only); this
// site does not use that branch (Supreme Court titles are unchanged here), it is ported so the shared fixture runs in full.
// Shared cases: scripts/judgments/display-title-fixture.json, the same cases as tests/core/test_display_title.py.
// Not exact: JS \w, \d and \b are ASCII-only (Python's are Unicode); the case-sensitive "MeherAge" rule is its own regex. See docs/JUDGMENTS-HC.md.
// Plain, erasable TypeScript (no enums or namespaces), so Node scripts can import this file directly (Node 24 strips the types).
export type CourtType = "supreme_court" | "high_court";
const MAX_LEN = 240;

const REG_PREFIX = /^\s*[^/]{0,40}?\/\s*[\w.\-()]+\s*\/\s*\d{4}\s+of\s+/i;   // "WP/40051/2016 of", "/151/2022 of"
const REG_PREFIX_LOOSE = /^\s*[\w.\-()/ ]{0,40}?\/\s*\d{4}\s+of\s+/i;
const NUMBER_OF_YEAR = /^\s*[\w.\-/() ]{0,30}?\d+\s+of\s+\d{4}\s*$/i;      // "CIVIL APPEAL 3073 of 2008": a number, no party
// "Vs", "v/s", "versus" win; a lowercase "v." counts only when none is present (a capital "V." is usually a middle initial).
const SEPARATOR = /(\s+(?:vs\.?|v\/s\.?|versus)\s+)/i;
const SEPARATOR_V = /(\s+v\.\s+)/;
const TRAILING_SEPARATOR = /\s+(?:vs\.?|v\/s\.?|versus)\s*$/i;
// A tail that starts a relation, an address, an age or an occupation: cut from there to the end of that party.
const TAIL = new RegExp([
  String.raw`\b[SWDC]\s*/\s*O\b\.?`, String.raw`\b(?:son|wife|daughter|widow|husband)\s+of\b`, String.raw`\bR\s*/\s*[OA]t?\b\.?`,
  String.raw`\bresident\s+of\b|\bresiding\b`, String.raw`\b(?:age|aged)\b\s*(?:about\s*)?:?\s*\d`, String.raw`\bocc(?:upation)?\b\.?`,
  String.raw`\bpermanent\s+address\b|\bat\s+post\b|\bpost\s*:`,
].join("|"), "i");
const TAIL_AGE_GLUED = /(?<=[a-z])Age\s*\d/;   // "MeherAge 72", case-sensitive: never "VILLAGE" (Python: an inline (?-i:...) group)
const OCCUPATIONS = "clerk|teacher|driver|farmer|agriculturist|labourer|laborer|businessman|retired|pensioner|housewife|house wife|student|shopkeeper|tailor|mason|carpenter|cultivator|nurse|peon";
const OCCUPATION_TAIL = new RegExp(String.raw`,\s*(?:\w+\s+){0,2}(?:${OCCUPATIONS})\b.*$`, "i");
const DANGLING = /[\s,]*\b(?:rep(?:resented|\.)?\s*by|thr(?:ough|\.)?)[\s,.]*$/i;

export const JUDGE = new RegExp(
  String.raw`\[[^\]]*(?:\bCJI\b|\bJ\.|\bJJ\b|\bC\.J)|\bC\.?J\.?I\.?\b|\(\s*J\.?\s*\)` +
  String.raw`|\bHON'?BLE\s+(?:MR\.?|MRS\.?|MS\.?|DR\.?|SHRI|SMT\.?|CHIEF|JUSTICE|JUDGE)\b|\b(?:MR|MRS|MS)\.?\s+JUSTICE\b|\bCHIEF\s+JUSTICE\b` +
  String.raw`|(?:^|\b(?:vs\.?|v/s\.?|versus|v\.)\s+|\b(?:SHRI|SMT|DR|MR|MRS|MS|THE)\.?\s+)` +
  String.raw`JUSTICE\b(?!\s+(?:FOR|OF|AND|&|AFFAIRS|DEPARTMENT|MINISTRY|DELIVERY|SYSTEM|BOARD|COMMITTEE)\b)[\s.]*[A-Z]`, "i");
const RETIRED_JUDGE_PARTY = /\bJUSTICE\b(?=[^,]{0,40}\(\s*RETD\.?\s*\))/gi;
export const ADVOCATE = /\badvocates?\b|\badv\b\.?|\bcounsel\b/i;
export const ADVOCATE_BODY = /advocates?[\s-]+general|advocates?[\s-]+on[\s-]+record\s+assoc|advocates?'?s?\s+(?:bar\s+)?(?:association|welfare|clerks?|academy|forum)|bar\s+council|council\s+for\s+the\s+state|legal\s+advis/i;
export const MINOR = /\(\s*minor\s*\)|\bminor\b(?!\s+(?:irr|mineral|port|forest|canal|water|works|pr?oject|div|dev|industr|civil|head|scale|var))|\bjuvenile\b(?!\s+justice)|\bnext\s+friend\b|\bnatural\s+guardian\b|\bguardian\b|\bchild\s+in\s+conflict\b/i;
export const ID_NUMBER = /\bC\s*\.?\s*NO\.?\s*\d{3,}|\(\s*[A-Z]-?\s*\d{3,}\s*\)|\b(?:PC|HC|SI|ASI|CT|CNO)\s*\.?\s*\d{3,}\b|\bNO\.?\s*\d{5,}\b/i;
const COMPANY_OR_SHIP_ID = /\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b|\bIMO\s*(?:NO\.?)?\s*\d{7}\b/gi;
const LONG_DIGITS = /\d{6,}/;
const BAD_CHARACTERS = /�|Ã|â€/;

/** Text before the first relation / age / address / occupation marker (Python: one regex, split at its first match). */
const beforeTail = (t: string): string => { const a = TAIL.exec(t), b = TAIL_AGE_GLUED.exec(t), i = Math.min(a ? a.index : Infinity, b ? b.index : Infinity); return i === Infinity ? t : t.slice(0, i); };
const trimChars = (t: string): string => t.replace(/^[ ,;:-]+|[ ,;:-]+$/g, "");

function party(text: string): string {
  const t = trimChars(beforeTail(text).replace(OCCUPATION_TAIL, "").replace(DANGLING, "").replace(/\s+/g, " ").trim());
  return t.replace(/\s+\.$/, "");   // a lone "." left by a cut; "PVT.LTD." stays
}
/** Python re.split(pattern, text, maxsplit=1) with one capture group: [text] or [before, separator, after]. */
const splitOnce = (re: RegExp, t: string): string[] => { const m = re.exec(t); return m ? [t.slice(0, m.index), m[1], t.slice(m.index + m[0].length)] : [t]; };

function highCourt(input: string): string | null {
  let text = input;
  const match = REG_PREFIX.exec(text);
  if (match) text = text.slice(match[0].length);
  else if (NUMBER_OF_YEAR.test(text) || !/[A-Za-z]{3}/.test(text)) return null;   // a registration number and no party
  else text = text.replace(REG_PREFIX_LOOSE, "");
  text = text.replace(TRAILING_SEPARATOR, "");   // "COMPANY LTD Vs" with no second party
  let pieces = splitOnce(SEPARATOR, text);
  if (pieces.length === 1) pieces = splitOnce(SEPARATOR_V, text);
  if (pieces.length === 1 && !match) return null;   // "WRIT PETITION 4379": a case type and a number, not parties
  const parties = [party(pieces[0])];
  if (pieces.length === 3) parties.push(party(pieces[2]));
  const keep = parties.filter((p) => /[A-Za-z]/.test(p));   // a placeholder side ("-", "....") is dropped
  if (keep.length === 2) return `${keep[0]} ${pieces[1].trim()} ${keep[1]}`;
  return keep[0] ?? null;
}
const supremeCourt = (text: string): string => text.replace(/\s*versus\s*(?:vs\.?)?\s*$/i, "").replace(/\s+/g, " ").replace(/^[ ,;]+|[ ,;]+$/g, "");

/** [title or null, reason]. reason is "ok" or why the title fell back (the export counts them). */
export function explainTitle(raw: unknown, courtType: CourtType = "high_court"): [string | null, string] {
  if (typeof raw !== "string" || !raw.trim()) return [null, "empty"];
  if (BAD_CHARACTERS.test(raw)) return [null, "bad_characters"];
  const text = raw.replace(/\bNone\b/g, " ").replace(/\s+/g, " ").trim();
  let shown = courtType === "supreme_court" ? supremeCourt(text) : highCourt(text);
  if (shown === null) return [null, "no_parties"];
  shown = shown.trim();
  if (!/[A-Za-z]{2}/.test(shown)) return [null, "empty_after_cleaning"];
  if (JUDGE.test(shown.replace(RETIRED_JUDGE_PARTY, " "))) return [null, "judge_marker"];
  if (ADVOCATE.test(shown) && !ADVOCATE_BODY.test(shown)) return [null, "advocate_marker"];
  if (MINOR.test(shown)) return [null, "minor_marker"];
  const numbers = shown.replace(COMPANY_OR_SHIP_ID, " ");
  if (LONG_DIGITS.test(numbers) || ID_NUMBER.test(numbers)) return [null, "pin_or_long_digits"];
  if (shown.length > MAX_LEN) return [null, "too_long"];
  return [shown, "ok"];
}

/** The High Court case title to show, or null. */
export const cleanTitle = (raw: unknown): string | null => explainTitle(raw)[0];

/** Why a title about to be shown is not clean (empty when it is): the guard's check on the `title` field. The same blockers as explainTitle, plus every
 *  relation / age / address / occupation marker and any registration prefix or "None" (cleanTitle cuts those, so one left over is a bug, or a title that
 *  was never cleaned). " Vs " and " v. " are allowed here. */
export function titleHits(t: string): string[] {
  const out: string[] = [];
  if (BAD_CHARACTERS.test(t)) out.push("bad characters");
  if (REG_PREFIX.test(t) || /\bNone\b/.test(t)) out.push("not cleaned (registration prefix or None left)");   // an uncleaned source title
  if (JUDGE.test(t.replace(RETIRED_JUDGE_PARTY, " "))) out.push("judge marker");
  if (ADVOCATE.test(t) && !ADVOCATE_BODY.test(t)) out.push("advocate");
  if (MINOR.test(t)) out.push("minor or guardian");
  const numbers = t.replace(COMPANY_OR_SHIP_ID, " ");
  if (LONG_DIGITS.test(numbers) || ID_NUMBER.test(numbers)) out.push("PIN or id number");
  if (beforeTail(t) !== t) out.push("relation, age, address or occupation");
  if (t.length > MAX_LEN) out.push("too long");
  return out;
}
