// High Court record rules, shared by the export (export-judgments-hc.sql mirrors regTitle), the AWS merge, the site's page reader and the output guard.
// Plain JS, no dependencies. Tested in hcRecord.test.mjs, including that the SQL and this file give the same answer on the same titles.
// CNR prefix (the letters before the first digit of a case id) -> court. Measured over all 15.66M High Court case ids in snapshot v2026.08 (LexBharat-from-scratch reports/data-audit/out/court_prefix_map.csv).
export const HC_PREFIXES = {
  APHC: "andhra-pradesh-high-court",
  BRHC: "patna-high-court",
  CGHC: "chhattisgarh-high-court",
  DLHC: "delhi-high-court",
  GAHC: "gauhati-high-court",
  GJHC: "gujarat-high-court",
  HBHC: "telangana-high-court",
  HCBM: "bombay-high-court",
  HCMA: "madras-high-court",
  HCMD: "madras-high-court",
  HPHC: "himachal-pradesh-high-court",
  JHHC: "jharkhand-high-court",
  JKHC: "high-court-of-jammu-and-kashmir-and-ladakh",
  KAHC: "karnataka-high-court",
  KLHC: "kerala-high-court",
  MLHC: "meghalaya-high-court",
  MNHC: "manipur-high-court",
  MPHC: "madhya-pradesh-high-court",
  ODHC: "orissa-high-court",
  PHHC: "punjab-and-haryana-high-court",
  RJHC: "rajasthan-high-court",
  SKHC: "sikkim-high-court",
  TRHC: "tripura-high-court",
  UKHC: "uttarakhand-high-court",
  UPHC: "allahabad-high-court",
  WBCHCA: "calcutta-high-court",
  WBCHCJ: "calcutta-high-court",
  WBCHCO: "calcutta-high-court",
  WBCHCP: "calcutta-high-court",
};

/** The court a High Court case id belongs to, from its CNR prefix (the letters before the first digit), or null for an unknown prefix. Never from the court label. */
export const courtOfId = (id) => HC_PREFIXES[/^[A-Z]+/.exec(String(id ?? ""))?.[0] ?? ""] ?? null;

// "WP(C)/19571/2019 of K.G.RAJU Vs ..." and "/151/2022 of ..." (no case type): everything after the year is the party tail and is cut.
const R1 = /^\s*([^/]{0,40}?)\s*\/\s*(\d{1,7})\s*\/\s*(\d{4})(?:\s|$)/;
// "WRIT PETITION 609 of 1999", "WRIT PETITION 2702/2014": the whole title is the registration form (no party tail).
const R2 = /^([A-Za-z][A-Za-z0-9 .()&,-]{0,60}?)\s+(?:No\.?\s*)?(\d{1,7})\s*(?:\/|\s(?:of|OF|Of)\s)\s*(\d{4})$/;
const noNone = (t) => { const x = String(t ?? "").replace(/\s*\bNone\s*$/, "").replace(/^None\s+/, "").replace(/\s+/g, " ").trim(); return x && x !== "None" ? x : null; };

/** Title cut to its registration form, and the case number read from it ("933/2024"). A title in any other shape may hold names, so it is dropped (both null). */
export function regTitle(raw) {
  const t = noNone(raw); if (!t) return { title: null, caseNumber: null };
  let m = R1.exec(t);
  if (m) { const type = m[1].trim(); return { title: `${type ? `${type}/` : ""}${m[2]}/${m[3]}`, caseNumber: `${Number(m[2])}/${m[3]}` }; }
  m = R2.exec(t);
  if (m) return { title: t, caseNumber: `${Number(m[2])}/${m[3]}` };
  return { title: null, caseNumber: null };
}

/** true when a title is in the form regTitle() writes: "WP(C)/19571/2019", "151/2022" or "WRIT PETITION 609 of 1999". */
export const isRegForm = (t) => /^(?:[^/]{1,40}\/)?\d{1,7}\/\d{4}$/.test(t) || R2.test(t);

/** The only fields a High Court case row may carry, in the exported pages and on the site. No parties, judges, bench size or advocates. */
export const HC_FIELDS = ["caseId", "title", "caseNumber", "caseNumberRecorded", "decisionDate", "disposition", "dispositionLabel", "citation", "dateOfRegistration", "pages", "mainPage"];
/** Keeps only HC_FIELDS (and drops null/undefined), so an older export that still holds petitioner, respondent or judges can never reach a page. */
export function pickHcFields(row) { const o = {}; for (const k of HC_FIELDS) if (row[k] !== null && row[k] !== undefined) o[k] = row[k]; return o; }
