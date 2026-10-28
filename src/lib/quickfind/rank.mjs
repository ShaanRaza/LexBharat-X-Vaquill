// Quick-find's understanding of a number: what was typed, which Act a section number is best known from, how to order sections that share a number, and when a number may match a judgment.
// PURE logic (no database, no network, no styling). The popular Acts and the well-known numbers are NOT here: they are in src/config/quickfind.json, passed in as `cfg`. Exact words only; no Voyage.
import { parseUnitNumber, unitLabel } from "../acts/unitLabel.mjs";

const NUM = String.raw`(\d{1,4}[A-Za-z]{0,2})`, SEC = String.raw`(?:s\.?|sec\.?|section|sections|§)`;
const STOP = new Set(["the", "of", "act", "in", "s", "sec", "section", "sections", "no"]);
const words = (s) => String(s ?? "").toLowerCase().replace(/[.,;:()]/g, " ").replace(/\s+/g, " ").trim();

/** The Acts a typed phrase can mean ("ni", "NI Act", "negotiable", "cpc", "gst"), as config keys, most popular first. Every word must match a name word; words of 3 letters or fewer must match exactly. */
export function resolveActs(phrase, cfg) {
  const typed = words(phrase), tokens = typed.split(" ").filter((t) => t && !STOP.has(t)); if (!tokens.length) return [];
  const out = [];
  for (const a of cfg.acts) {
    const nameWords = new Set(a.names.flatMap((n) => words(n).split(" ")));
    const whole = a.names.some((n) => words(n) === typed || words(n).replace(/ act$/, "") === typed.replace(/ act$/, ""));
    const each = tokens.every((t) => nameWords.has(t) || (t.length >= 4 && [...nameWords].some((w) => w.startsWith(t))));
    if (whole || each) out.push(a.key);
  }
  return out;
}

/** What the box holds: a bare number ("138", "43A"), a number with an Act ("138 NI", "NI 138", "s.138 NI Act", "section 138 negotiable"), or something else (text). */
export function parseQuick(q, cfg) {
  const s = String(q ?? "").trim().replace(/\s+/g, " ");
  let m = new RegExp(`^${NUM}$`).exec(s);
  if (m) return { kind: "number", number: m[1].toUpperCase() };
  m = new RegExp(`^(?:${SEC}\\s*)?${NUM}\\s+(?:of\\s+(?:the\\s+)?)?(.+)$`, "i").exec(s);
  if (m && !/^\d/.test(m[2])) { const acts = resolveActs(m[2], cfg); if (acts.length) return { kind: "act-number", number: m[1].toUpperCase(), acts }; }
  m = new RegExp(`^(.+?)[\\s,]+(?:${SEC}\\s*)?${NUM}$`, "i").exec(s);
  if (m && !/^\d/.test(m[1])) { const acts = resolveActs(m[1], cfg); if (acts.length) return { kind: "act-number", number: m[2].toUpperCase(), acts }; }
  return { kind: "text" };
}

/** The config key of a central Act by its title (State copies share titles, so they are never "popular"), or null. */
export function popularKey(actTitle, category, cfg) {
  if (category && category !== "central") return null;
  const t = String(actTitle ?? "").toLowerCase();
  return cfg.acts.find((a) => t.startsWith(a.title))?.key ?? null;
}
/** The title starts to look for in the database for some config keys. */
export const titlePrefixes = (keys, cfg) => cfg.acts.filter((a) => keys.includes(a.key)).map((a) => a.title);

/** Orders sections or Articles that share a number: first the Act the number is best known from (`wellKnown`), then the popular Acts in their listed order, then Central before State, in force before repealed,
 *  then shorter titles. A popular Act that is repealed (IPC, CrPC, Evidence Act) still counts as popular: lawyers still look them up. Returns a new array. */
export function rankNumbered(rows, number, cfg) {
  const order = cfg.acts.map((a) => a.key), known = cfg.wellKnown?.[String(number).toUpperCase()] ?? [];
  const score = (r) => { const k = popularKey(r.actTitle, r.category, cfg), wk = k ? known.indexOf(k) : -1, pop = k ? order.indexOf(k) : -1;
    return [wk >= 0 ? wk : 99, pop >= 0 ? pop : 99, r.category === "central" ? 0 : 1, r.actStatus === "in_force" ? 0 : 1, String(r.actTitle ?? "").length]; };
  return [...rows].sort((a, b) => { const x = score(a), y = score(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
}

// ---- judgments: a number matches a case number or a full citation, never a report page number ("8 S.C.R. 138")
const CITE = /\b(?:s\.?\s?c\.?\s?r\.?|s\.?\s?c\.?\s?c\.?|a\.?\s?i\.?\s?r\.?|insc)\b/i;
/** True if the query is a whole citation: a report abbreviation with at least two numbers ("[2014] 11 S.C.R. 921", "(2014) 8 SCC 138", "2014 INSC 514"). */
export const isFullCitation = (q) => CITE.test(String(q ?? "")) && (String(q).match(/\d+/g) ?? []).length >= 2;
const standalone = (text, n) => new RegExp(`(?<![\\d])${n}(?![\\d])`).test(String(text ?? ""));
const abbrOf = (q) => (CITE.exec(String(q ?? ""))?.[0] ?? "").replace(/[\s.]/g, "").toUpperCase();
/** May this judgment hit stay for this query? Every number in the query must be a case number of the judgment ("Civil Appeal No. 138 of 2014"). When the whole query is a citation, every number must be in the citation of
 *  the SAME report series instead ("[2014] 11 S.C.R. 921" is not "(2014) 11 SCC 921"; "2014 INSC 514" is matched against the case id). Queries with no number are untouched. */
export function numericOk(query, hit) {
  const nums = String(query ?? "").match(/\d+[A-Za-z]{0,2}/g)?.map((n) => n.replace(/[A-Za-z]+$/, "")) ?? [];
  if (!nums.length) return true;
  if (!isFullCitation(query)) return nums.every((n) => standalone(hit.caseNumber, n));
  const ab = abbrOf(query), text = ab === "INSC" ? String(hit.caseId ?? "").replace(/_/g, " ") : String(hit.citation ?? "");
  return text.replace(/[\s.]/g, "").toUpperCase().includes(ab) && nums.every((n) => standalone(text, n));
}

// ---- readable names for Schedule units
const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function toRoman(n) { let x = Number(n), s = ""; if (!Number.isInteger(x) || x < 1 || x > 3999) return String(n); for (const [v, r] of ROMAN) while (x >= v) { s += r; x -= v; } return s; }
const roman = (o) => { const m = /^(\d+)([A-Z]*)$/.exec(o); return m ? toRoman(m[1]) + m[2] : o; };
/** "O18R7" -> "Order XVIII Rule 7", "O39" -> "Order XXXIX", "A21" -> "Article 21", "138" -> "Section 138". Orders are written in Roman numerals as the Code of Civil Procedure prints them. */
export function unitReadable(number) {
  const u = parseUnitNumber(number);
  if (!u) return `Section ${number}`;
  if (u.kind === "order") return `Order ${roman(u.order)}`;
  if (u.kind === "rule") return `Order ${roman(u.order)} Rule ${u.rule}`;
  return unitLabel(number);   // Articles, the Preamble, Appendices and Schedules keep the wording the Act page already uses
}
