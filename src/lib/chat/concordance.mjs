// Old law <-> new law for the three criminal codes replaced on 1 July 2024: IPC -> BNS, CrPC -> BNSS, Indian Evidence Act -> BSA. PURE logic.
// ONE table, ONE reader: src/config/law-mapping.json (built from the Government's own correspondence tables, see its README). Here only rows with `pairing_confirmed` are used: both documents agree on the pairing.
// A pairing may be NAMED in an answer whenever it is confirmed; when a section's text is not in our data the answer says so. Links and "checked against our data" are the `linkable` / `verified` rows' business, not this module's.
import data from "../../config/law-mapping.json" with { type: "json" };
import { baseNumber } from "../acts/lawMapping.mjs";

export const EFFECTIVE = "1 July 2024";
const SHORT = { ipc: "IPC", crpc: "CrPC", evidence: "IEA", bns: "BNS", bnss: "BNSS", bsa: "BSA" };
const LOOKUP = { ipc: "IPC", crpc: "CrPC", evidence: "Evidence Act", bns: "BNS", bnss: "BNSS", bsa: "BSA" };   // what the section lookup understands: "103 BNS", "65B Evidence Act"
const TITLE = { ipc: "the indian penal code", crpc: "the code of criminal procedure", evidence: "the indian evidence act", bns: "the bharatiya nyaya sanhita", bnss: "the bharatiya nagarik suraksha sanhita", bsa: "the bharatiya sakshya adhiniyam" };
const nameOf = (law) => data.laws[law].name;

/** Which of the six Acts a source title belongs to: { law, side: "old" | "new" } or null. An amending Act of the same name is its own Act, not the code. */
export function actSide(title) {
  const t = String(title ?? "").toLowerCase().trim();
  for (const [law, start] of Object.entries(TITLE)) if (t.startsWith(start) && !/^[\s,(]*(?:\(\s*)?(?:amendment|amending|second|third)\b/.test(t.slice(start.length))) return { law, side: data.laws[law].kind };
  return null;
}

const index = (() => {
  const byOld = new Map(), byNew = new Map(), put = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
  for (const r of data.rows) {
    if (r.pairing_confirmed !== true) continue;
    const base = { law: r.old_law, number: baseNumber(r.old_section), title: r.old_title, textInData: r.old_text_in_data !== false };
    put(byOld, `${r.old_law}|${baseNumber(r.old_section)}`, { law: r.new_law, number: String(r.new_section), title: r.new_title, textInData: r.new_text_in_data !== false, old: base, selfText: base.textInData });
    for (const a of r.also_new_sections ?? []) if (a.pairing_confirmed === true) put(byOld, `${r.old_law}|${baseNumber(r.old_section)}`, { law: r.new_law, number: String(a.new_section), title: a.new_title, textInData: a.new_text_in_data !== false, old: base, selfText: base.textInData });
  }
  for (const rows of byOld.values()) for (const n of rows) put(byNew, `${n.law}|${baseNumber(n.number)}`, { law: n.old.law, number: n.old.number, title: n.old.title, textInData: n.old.textInData, partnerOf: n, selfText: n.textInData });
  return { byOld, byNew };
})();

/** A heading fit to print: the section's own title, never text the extraction left in the heading (an amendment note, a run-on sentence, a preamble). */
export function usableTitle(t) {
  const x = String(t ?? "").replace(/\s+/g, " ").split(/\s*\.\s*[\u2014-]/)[0].replace(/[.\s]+$/, "").trim();
  return x && x.length <= 70 && !/^\(no heading/.test(x) && !/^(subs\.|ins\.|omitted|the word|the government of india|as to |added)/i.test(x) ? x : null;
}
const partner = (p, side) => ({ law: p.law, side, short: SHORT[p.law], lookup: LOOKUP[p.law], name: nameOf(p.law), number: p.number, title: usableTitle(p.title), textInData: p.textInData, selfTextInData: p.selfText !== false });

/** The confirmed counterparts of one section: [{ law, side ("old"|"new": the side the COUNTERPART is on), short, lookup, name, number ("103(1)" when the table gives a sub-section), title, textInData }]. */
export function counterparts({ actTitle, number }) {
  const a = actSide(actTitle); if (!a || number == null) return [];
  const key = `${a.law}|${baseNumber(number)}`;
  return ((a.side === "old" ? index.byOld : index.byNew).get(key) ?? []).map((p) => partner(p, a.side === "old" ? "new" : "old"));
}
/** Counterparts of a section named by a short code as in a lookup ("IPC", "BNS", "CrPC", "BNSS", "BSA", "Evidence Act"). */
export function counterpartsOfShort(short, number) {
  const s = String(short).toLowerCase();
  const law = Object.keys(SHORT).find((l) => SHORT[l].toLowerCase() === s || LOOKUP[l].toLowerCase() === s || (l === "evidence" && s === "evidence act"));
  return law ? counterparts({ actTitle: TITLE[law], number }) : [];
}
/** { law, number } of a lookup string as the question produces it ("302 IPC", "103 BNS", "65B Evidence Act", "34 Indian Penal Code"), or null. */
export function lookupLaw(lookup) {
  const m = /^(\d{1,4}[A-Za-z]{0,2})\s+(.+)$/.exec(String(lookup).trim()); if (!m) return null;
  const s = m[2].toLowerCase(), law = Object.keys(SHORT).find((l) => SHORT[l].toLowerCase() === s || LOOKUP[l].toLowerCase() === s) ?? actSide(/^the\s/i.test(m[2]) ? m[2] : `the ${m[2]}`)?.law;
  return law ? { law, number: m[1].toUpperCase() } : null;
}
export function counterpartsOfLookup(lookup) { const l = lookupLaw(lookup); return l ? counterparts({ actTitle: TITLE[l.law], number: l.number }) : []; }
/** Pairs for a section the question names that we could not retrieve (not held): the confirmed counterpart is still named, and the missing text is said to be missing. `have` = "number|counterpart" keys already covered. */
export function pairsOfNamed(lookups, have = new Set()) {
  const out = [];
  for (const lk of lookups) {
    const l = lookupLaw(lk); if (!l) continue;
    for (const p of counterparts({ actTitle: TITLE[l.law], number: l.number })) {
      const k = `${l.law}|${l.number}|${p.number}`; if (have.has(k)) continue; have.add(k);
      out.push({ self: { law: l.law, side: data.laws[l.law].kind, short: SHORT[l.law], name: nameOf(l.law), number: l.number, title: null, textInData: p.selfTextInData }, partner: p });
    }
  }
  return out;
}
/** "103 BNS" / "302 IPC": the lookup string that finds a counterpart in the Acts search. */
export const lookupFor = (p) => `${baseNumber(p.number)} ${p.lookup}`;

const sectionText = (p) => `section ${p.number} of the ${p.name}${p.title ? ` (${p.title})` : ""}`;

/** pairs for the sources that were retrieved: every source section that belongs to one of the six Acts, with each of its confirmed counterparts. */
export function pairsOf(sources) {
  const out = [], seen = new Set();
  for (const s of sources) {
    if (s.kind === "judgment" || s.kind === "doc" || s.number == null) continue;
    const a = actSide(s.actTitle); if (!a) continue;
    for (const p of counterparts({ actTitle: s.actTitle, number: s.number })) {
      const k = `${a.law}|${s.number}|${p.number}`; if (seen.has(k)) continue; seen.add(k);
      out.push({ self: { law: a.law, side: a.side, short: SHORT[a.law], name: nameOf(a.law), number: String(s.number), title: s.heading ?? null, n: s.n, textInData: true }, partner: p });
    }
  }
  return out;
}

/** The note for the answer prompt: for each pair in play, which section is the current law and which the old law it replaced. A section whose text is not in our data is said to be missing; its number is still known from the table. null when empty. */
export function mappingNote(pairs) {
  const lines = [];
  for (const { self, partner: p } of pairs.slice(0, 6)) {
    const [o, n] = p.side === "old" ? [p, self] : [self, p];
    const miss = [o, n].filter((x) => x.textInData === false).map((x) => `${x.short} section ${x.number}`);
    lines.push(`- ${sectionText(n)} is the CURRENT law (in force from ${EFFECTIVE}); it replaced ${sectionText(o)}, the OLD law.${miss.length ? ` The text of ${miss.join(" and ")} is not in our data yet.` : ""}`);
  }
  return lines.length ? lines.join("\n") : null;
}
export const MAPPING_ADDENDUM = (note) => `

Old law and new law. These pairs come from the Government's own correspondence tables, confirmed by two documents; use no other mapping and never guess one:
${note}
Extra rules: say which provision is the current law and which is the old law it replaced, naming the old section with its Act ("previously Section 302 of the Indian Penal Code"). If the question uses an old section number, answer with the current section and say it replaced the old one. If the question uses a new section number, also name the old section it replaced. If the text of a section is not among the sources, give only its number and name from this list and say plainly that its text is not in our data yet; never describe a section whose text you were not given.`;

const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Does the text name this section of this Act (its number near the Act's name or short name)? */
export function mentions(text, p) {
  const num = esc(baseNumber(p.number)), names = [p.short, p.name.replace(/,\s*\d{4}$/, ""), p.lookup].map(esc).join("|");
  return new RegExp(`(?:(?:${names})[^.\\n]{0,40}?\\b(?:sections?|s\\.|sec\\.)?\\s*${num}\\b|\\b(?:sections?|s\\.|sec\\.)\\s*${num}\\b[^.\\n]{0,60}?(?:${names}))`, "i").test(text);
}
const listNums = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** The lines to add when an answer does not name both laws: ONE line per section the answer rests on, built from ALL its confirmed counterparts (e.g. "Section 356 of the Bharatiya Nyaya Sanhita, 2023 replaces sections 499, 500, 501 and 502 of the Indian Penal Code, 1860."),
 *  including any the answer already names, so the model's own sentence is never followed by extra one-by-one lines. Nothing is added when the answer already names every counterpart. `pairs` = pairsOf(sources) for the sections the answer rests on;
 *  `citeOf(p)` gives "[n]" for a counterpart that is among the sources. At most 2 lines, each from the table. */
export function missingMentions(answer, pairs, citeOf = () => "") {
  const groups = new Map();
  for (const { self, partner: p } of pairs) { const k = `${self.law}|${self.number}|${p.law}`; (groups.get(k) ?? groups.set(k, { self, list: [] }).get(k)).list.push(p); }
  const out = [];
  for (const { self, list } of groups.values()) {
    if (out.length >= 2) break;
    if (list.every((p) => mentions(answer, p))) continue;
    const nums = list.map((p) => `${p.number}${citeOf(p) ? ` ${citeOf(p)}` : ""}`), side = list[0].side, one = list.length === 1;
    const gap = list.filter((p) => p.textInData === false).map((p) => `${p.short} section ${p.number}`), note = gap.length ? ` The text of ${listNums(gap)} is not in our data yet.` : "";
    const theirs = `${one ? "section" : "sections"} ${listNums(nums)} of the ${list[0].name}${one && list[0].title ? ` (${list[0].title})` : ""}`;
    out.push({ partner: list[0], partners: list, line: side === "old" ? `Section ${self.number} of the ${self.name} replaces ${theirs}.${note}` : `Section ${self.number} of the ${self.name} is replaced by ${theirs} (the current law, in force from ${EFFECTIVE}).${note}` });
  }
  return out;
}

/** A function p -> "[n]" for a counterpart that is among the sources (the same Act and section number), "" when it is not. */
export function citeFinder(sources) {
  return (p) => { const s = sources.find((x) => x.kind !== "judgment" && x.kind !== "doc" && x.number != null && actSide(x.actTitle)?.law === p.law && baseNumber(x.number) === baseNumber(p.number)); return s ? `[${s.n}]` : ""; };
}

/** The Act record our data files the law under (src/config/law-mapping.json `laws`): where a counterpart is looked up first, so the canonical filing is used and not a State copy of the same Act. */
export const actIdFor = (law) => data.laws[law]?.actId ?? null;
