// THE document-type model. Every label that depends on WHAT a document is (an Act, the Constitution, a regulator's circular or rules, a judgment) comes from here: the name of its units (Section, Article, Rule, Regulation,
// Paragraph), where to read the original and what to call that place, how its title is written (capitals for acronyms, a fallback when the data has none). PURE logic: no database, no styling.
// A `doc` is { title, category?, department?, actId? } (the fields every Act record, search hit and citation already carries).
import acronyms from "../../config/acronyms.json" with { type: "json" };
import { departmentLabel, isRegulatorId } from "../acts/departments.mjs";
import { unitLabel } from "../acts/unitLabel.mjs";

const INDIA_CODE = /^https:\/\/(?:www\.)?indiacode\.(?:nic|gov)\.in\//;
export const INDIA_CODE_HOME = "https://indiacode.gov.in/";
// India Code moved from www.indiacode.nic.in to indiacode.gov.in. The old pages (handle/123456789/<id>, repealed-act.jsp ...) no longer open, the new site names an Act by an id we do not hold, and
// our stored source_url is still the old address (10,100 of 10,113 Acts). So an old address becomes the new site's search for the Act's title, which always opens; its home page when there is no title.
const INDIA_CODE_ACTS = "https://indiacode.gov.in/collections/69a0c1fb-7b22-4481-b16a-1dc59b5d02e6";
const OLD_INDIA_CODE = /^https:\/\/(?:www\.)?indiacode\.nic\.in\//;
/** The new India Code's search for an Act by its title ("The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)" is searched as "The Indian Penal Code"). */
export function indiaCodeSearchUrl(title) {
  const q = String(title ?? "").replace(/\([^)]*\)/g, " ").replace(/,?\s*\d+ of \d{4}\b/g, " ").replace(/\s+/g, " ").replace(/[\s,]+$/, "").trim();
  return q ? `${INDIA_CODE_ACTS}?query=${encodeURIComponent(q)}` : INDIA_CODE_HOME;
}
/** An address that opens: the old India Code address becomes the new site's search for `title` (or its home page); every other address is returned as it is. */
export const liveIndiaCodeUrl = (url, title) => (typeof url === "string" && OLD_INDIA_CODE.test(url) ? indiaCodeSearchUrl(title) : url);

/** { type, unit, units } for a document. type: "constitution" | "act" | "rules" | "regulations" | "instrument" (a regulator's circular, notification, order, advisory, direction). */
export function docTypeOf(doc = {}) {
  const title = String(doc.title ?? ""), regulator = doc.category === "regulatory" || !!doc.department || isRegulatorId(doc.actId);
  if (/^\s*(the\s+)?constitution of india\b/i.test(title) && !regulator) return { type: "constitution", unit: "Article", units: "Articles" };
  if (/\b(act|code|sanhita|adhiniyam|ordinance)\b[^a-z]*(,?\s*\d{4})?[^a-z]*$/i.test(title.replace(/\([^)]*\)/g, " ")) && !/\brules?\b|\bregulations?\b/i.test(title.replace(/\([^)]*\)/g, " "))) return { type: "act", unit: "Section", units: "Sections" };
  if (/\brules?\b/i.test(title) && !/\b(ruling|rulings)\b/i.test(title)) return { type: "rules", unit: "Rule", units: "Rules" };
  if (/\bregulations?\b/i.test(title)) return { type: "regulations", unit: "Regulation", units: "Regulations" };
  if (regulator) return { type: "instrument", unit: "Paragraph", units: "Paragraphs" };
  return { type: "act", unit: "Section", units: "Sections" };
}

/** The words that name a unit by its stored number: "Order 39 Rule 1", "Article 226", "Section 138", "Rule 3", "Paragraph 4". Orders, Rules and Articles of an Act's Schedules keep their own wording. */
export function unitWord(number, doc) {
  const special = unitLabel(number);
  if (special) return special;
  const t = docTypeOf(doc);
  return `${t.unit} ${number}`;
}
export const unitsWord = (doc) => docTypeOf(doc).units.toLowerCase();

/** Where to read the original and what to call that place: { url, label } or null (no link rather than a wrong one). An India Code page for an Act; for a regulator, the regulator's own page when the data has one. */
export function sourceInfo(doc = {}, url) {
  let u = typeof url === "string" ? url.trim() : "";
  const t = docTypeOf(doc), reg = t.type === "instrument" || t.type === "rules" || t.type === "regulations" ? !!(doc.department || doc.category === "regulatory" || isRegulatorId(doc.actId)) : false;
  if (reg && INDIA_CODE.test(u)) u = "";   // the data layer's default link is India Code; a regulator's own circular or rules are not published there
  if (u && INDIA_CODE.test(u)) { const live = liveIndiaCodeUrl(u, doc.title); return { url: live, label: live.startsWith(INDIA_CODE_ACTS) ? "India Code (search for this Act)" : "India Code" }; }
  if (reg) {
    if (/^https?:\/\//i.test(u)) { const dep = doc.department ? departmentLabel(doc.department) : null; let host = ""; try { host = new URL(u).hostname.replace(/^www\./, ""); } catch { /* unreadable */ } return { url: u, label: dep ? `${dep} website` : host || "the source" }; }
    return null;
  }
  if (/^https?:\/\//i.test(u)) { try { return { url: u, label: new URL(u).hostname.replace(/^www\./, "") }; } catch { /* fall through */ } }
  return { url: INDIA_CODE_HOME, label: "India Code" };
}

// ---- titles
const WORDS = acronyms.words, SMALL = new Set(acronyms.smallWords);
const isAllLower = (s) => !/[A-Z]/.test(s), upperShare = (s) => { const l = s.match(/[A-Za-z]/g) ?? []; return l.length ? (s.match(/[A-Z]/g) ?? []).length / l.length : 0; };
const titleCase = (w, i) => { const k = w.toLowerCase(); if (WORDS[k]) return WORDS[k]; if (i > 0 && SMALL.has(k)) return k; return k.charAt(0).toUpperCase() + k.slice(1); };

/** A title ready to print. Undoes URL encoding and underscores, separates glued letters and digits ("Advisory022026" -> "Advisory 02/2026", "01July2017" -> "01 July 2017"), puts all-lower or ALL-CAPITAL titles in title case, and writes
 *  acronyms in capitals everywhere (RBI, CGST, MoEFCC). Mixed-case titles keep their own capitals except for acronyms. When the data has no usable title: "<regulator> instrument (<year>)" or "Untitled". */
export function displayTitle(title, doc = {}) {
  let t = String(title ?? "");
  try { t = decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, "%25")); } catch { /* keep as is */ }
  t = t.replace(/_+/g, " ").replace(/\.(pdf|docx?)$/i, "").replace(/\s+/g, " ").trim();
  t = t.replace(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+){2,}\b/g, (m) => m.replace(/-/g, " "));        // "Criminal-Procedure-Code-CrPC-1973" (three or more hyphenated pieces)
  t = t.replace(/\b([A-Za-z]{3,})(\d{2})(\d{4})\b/g, "$1 $2/$3")                                // Advisory022026
       .replace(/\b(\d{1,2})([A-Za-z]{3,9})(\d{4})\b/g, "$1 $2 $3")                             // 01July2017
       .replace(/([A-Za-z]{3,})(\d{4})\b/g, "$1 $2").replace(/\b(\d{1,2})([A-Za-z]{4,})\b/g, "$1 $2");
  if (t.length < 3 || /^[0-9 ./-]+$/.test(t)) {
    const dep = doc.department ? departmentLabel(doc.department) : null, y = doc.year ? ` (${doc.year})` : "";
    return dep ? `${dep} instrument${y}` : t || "Untitled";
  }
  if (/[^\u0000-\u024f\u2000-\u206f]/.test(t)) return t;   // another script (Hindi): its own rules, left as written
  const words = t.split(" "), sig = words.filter((w) => /^[A-Za-z]{3,}$/.test(w.replace(/[^A-Za-z]/g, "")) && !SMALL.has(w.toLowerCase().replace(/[^a-z]/g, ""))), lowerSig = sig.filter((w) => w === w.toLowerCase()).length;
  const shouting = upperShare(t) > 0.8 || isAllLower(t) || (sig.length >= 2 && lowerSig / sig.length > 0.5);   // ALL CAPITALS, all lower case, or most words lower case ("The delhi rent control act")
  const fix = (w, i) => {
    const m = /^([^A-Za-z]*)([A-Za-z.]+)([^A-Za-z]*)$/.exec(w);
    if (!m) return w;
    const core = m[2], key = core.toLowerCase().replace(/\./g, "");
    if (WORDS[key] && (shouting || core === core.toLowerCase() || core === core.toUpperCase() || /^[A-Z][a-z]+$/.test(core) && WORDS[key] === key.toUpperCase())) return `${m[1]}${WORDS[key]}${m[3]}`;
    return shouting ? `${m[1]}${titleCase(core, i)}${m[3]}` : w;
  };
  return words.map((w, i) => (w.includes("-") ? w.split("-").map((p) => fix(p, i)).join("-") : fix(w, i))).join(" ");
}

/** The Library tab a document belongs to, for breadcrumbs: { label, href }. */
export function libraryHome(doc = {}) {
  const t = docTypeOf(doc);
  if (t.type === "constitution") return { label: "Constitution", href: "/library?tab=constitution" };
  if (doc.category === "regulatory" || doc.department || isRegulatorId(doc.actId)) return { label: "Regulators", href: "/library?tab=regulators" };
  return { label: "Acts", href: "/library?tab=acts" };
}

/** A case name ready to print: the data joins the two parties with "versus" and leaves it dangling when a party is missing ("IN RE: X versus ." / "versus"). Drops the dangling joiner and stray full stops; case names keep their own capitals. */
export function caseTitle(title) {
  let t = String(title ?? "").replace(/\s+/g, " ").trim();
  t = t.replace(/\s+(?:versus|vs\.?|v\.?)\s*[.,;:-]*\s*$/i, "").replace(/^\s*(?:versus|vs\.?|v\.?)\s+/i, "").replace(/\s+(?:versus|vs\.?)\s+[.,;:-]+\s*$/i, "");
  t = t.replace(/\s+[.]\s*$/, "").replace(/\s+([.,;:])/g, "$1");
  return t || String(title ?? "").trim();
}
