// Old law <-> new law lookup (IPC/BNS, CrPC/BNSS, Evidence Act/BSA). PURE logic over src/config/law-mapping.json (passed in, so tests can use their own): no database, no styling.
import { parseSectionLookup } from "./searchQuery.mjs";
import { cleanHeading } from "../text/clean.mjs";

export const UNVERIFIED_LABEL = "mapping not yet verified";
export const PAIRS = [["ipc", "bns"], ["crpc", "bnss"], ["evidence", "bsa"]];
const PHRASES = {
  ipc: "ipc", "indian penal code": "ipc", crpc: "crpc", "cr pc": "crpc", "code of criminal procedure": "crpc", "code of criminal procedure 1973": "crpc",
  evidence: "evidence", "evidence act": "evidence", "indian evidence act": "evidence", "indian evidence act 1872": "evidence", iea: "evidence",
  bns: "bns", "bharatiya nyaya sanhita": "bns", bnss: "bnss", "bharatiya nagarik suraksha sanhita": "bnss", bsa: "bsa", "bharatiya sakshya adhiniyam": "bsa",
};
const clean = (s) => s.toLowerCase().replace(/[.,;:]/g, " ").replace(/^the\s+/, "").replace(/\s+/g, " ").trim();
/** "304B" / "103(1)" -> "304B" / "103" (the number before any sub-section). */
export const baseNumber = (s) => String(s ?? "").replace(/\(.*$/, "").replace(/\s+/g, "").toUpperCase();

/** What to show for a row: verified rows as fact; everything else greyed with the label. Anything not exactly "verified" is NOT fact. */
export function presentation(row) {
  const fact = row?.status === "verified";
  return { fact, label: fact ? null : UNVERIFIED_LABEL, whatChanged: row?.what_changed || null };
}

/** The rows of one pair, in file order. */
export const rowsFor = (data, oldLaw) => data.rows.filter((r) => r.old_law === oldLaw);

/** Links for a row: only to a section the file says is in our data; the repo cannot tell otherwise, so no link rather than a maybe-broken one. */
export function rowLinks(row, data) {
  const link = (law, section, ok) => (ok === true && data.laws[law]?.actId ? `/law/${data.laws[law].actId}/s${baseNumber(section)}` : null);
  return { old: link(row.old_law, row.old_section, row.old_in_data), new: link(row.new_law, row.new_section, row.new_in_data) };
}

/** "302 IPC", "section 103 BNS", "IPC 302", "103(1) BNS", "Evidence Act 65B" -> { kind: "old"|"new", law, number, rows } ; a bare number searches every law ({ kind: "any" }); null when not understood. */
export function lookup(data, raw) {
  const q = String(raw ?? "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  if (!q) return null;
  let number, law = null;
  if (/^(?:s(?:ec(?:tion)?)?\.?\s*)?\d{1,4}[A-Za-z]{0,2}$/i.test(q)) number = q.replace(/^\D+/, "").toUpperCase();
  else {
    const p = parseSectionLookup(q);
    if (!p) return null;
    law = PHRASES[clean(p.actPhrase)] ?? null;
    if (!law) return null;
    number = baseNumber(p.number);
  }
  const isOld = (l) => data.laws[l]?.kind === "old";
  const rows = data.rows.filter((r) => {
    if (law) return law === r.old_law ? baseNumber(r.old_section) === number : law === r.new_law && baseNumber(r.new_section) === number;
    return baseNumber(r.old_section) === number || baseNumber(r.new_section) === number;
  });
  return { kind: law ? (isOld(law) ? "old" : "new") : "any", law, number, rows };
}

/** Rows whose section pair is checked against our data (both sections held, titles correspond): the `linkable` flag. Older rows without the flag count only if verified from our data. */
export const isChecked = (row) => (row?.linkable ?? (row?.old_in_data === true && row?.new_in_data === true));
export const checkedCount = (rows) => rows.filter(isChecked).length;

/** The short first-screen list: [{ label, rows }] from the common-sections config; a listed section that is not in the file is skipped, never invented. */
export function commonGroups(data, config) {
  return config.groups.map((g) => ({ label: g.label, rows: g.rows.flatMap(([law, sec]) => data.rows.filter((r) => r.old_law === law && r.old_section === sec)) })).filter((g) => g.rows.length);
}

// Section titles in law-mapping.json are the dataset's heading field as it is, so everything the page prints as a title goes through displayTitle (the shared cleanHeading: run-on text, footnote marks,
// footnotes and the builder's "(no heading in our data)" placeholder are removed). null means "no usable title": the page says so.
export const displayTitle = (raw) => cleanHeading(raw);
