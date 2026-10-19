// MOCK FIXTURES for the local Playground backend (src/lib/playgroundMock.ts). Nothing here is real Vaquill data.
// Citations and section headings are well-known public ones so results look plausible; every text body is placeholder text, and every
// URL points at example.test. Shapes are INFERRED from endpoint names and spec descriptions (docs/PLAYGROUND-TEARDOWN.md did not capture
// any paid response body).
import { jurisdictions } from "@/data/jurisdictions";
import { stateBreakdown } from "@/data/stateBreakdown";

export type Hit = {
  actId: string; citation: string; title: string; corpusType: string; state: string; code?: string;
  titleNumber?: number; chapter?: string; part?: string; article?: string;
  actStatus: string; goodLawStatus: string; lastUpdated: string; year: number; topics: string[]; defined?: [string, string][];
  publicLawCites?: string[]; neighbours?: string[]; citedBy?: string[]; crossState?: string[];
};

const H = (h: Hit): Hit => h;
export const HITS: Hit[] = [
  H({ actId: "USC_T42_S1983", citation: "42 U.S.C. § 1983", title: "Civil action for deprivation of rights", corpusType: "USC", state: "federal", titleNumber: 42, chapter: "21", actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-01-06", year: 1996, topics: ["civil rights", "deprivation of rights", "color of law", "damages"], publicLawCites: ["Pub. L. 104-317"], neighbours: ["USC_T42_S1982", "USC_T42_S1985"], citedBy: ["USC_T42_S1988", "CFR_T28_S35.130"], defined: [["person", "Placeholder definition of a person acting under color of law."]] }),
  H({ actId: "USC_T17_S107", citation: "17 U.S.C. § 107", title: "Limitations on exclusive rights: fair use", corpusType: "USC", state: "federal", titleNumber: 17, chapter: "1", actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-01-06", year: 2002, topics: ["copyright", "fair use", "criticism", "scholarship"], publicLawCites: ["Pub. L. 107-273"], neighbours: ["USC_T17_S106", "USC_T17_S108"], citedBy: ["USC_T17_S512"], defined: [["fair use", "Placeholder definition of the four-factor test."]] }),
  H({ actId: "USC_T29_S2612", citation: "29 U.S.C. § 2612", title: "Leave requirement", corpusType: "USC", state: "federal", titleNumber: 29, chapter: "28", actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-01-06", year: 2009, topics: ["employment", "family leave", "termination notice", "at-will"], neighbours: ["USC_T29_S2611", "USC_T29_S2613"], citedBy: ["CFR_T29_S825.100"] }),
  H({ actId: "CFR_T17_S240.10b-5", citation: "17 C.F.R. § 240.10b-5", title: "Employment of manipulative and deceptive devices", corpusType: "CFR", state: "federal", titleNumber: 17, part: "240", actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-03-14", year: 2021, topics: ["securities", "insider trading", "fraud", "penalties"], neighbours: ["CFR_T17_S240.10b-3", "CFR_T17_S240.10b5-1"], citedBy: ["USC_T15_S78j"], defined: [["security", "Placeholder definition."]] }),
  H({ actId: "CFR_T45_S164.502", citation: "45 C.F.R. § 164.502", title: "Uses and disclosures of protected health information: general rules", corpusType: "CFR", state: "federal", titleNumber: 45, part: "164", actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-02-02", year: 2024, topics: ["privacy", "health information", "HIPAA", "disclosure", "privacy rule"], neighbours: ["CFR_T45_S164.501", "CFR_T45_S164.504"], citedBy: ["CFR_T45_S164.508"], defined: [["protected health information", "Placeholder definition."]] }),
  H({ actId: "TX_PE_S31.03", citation: "Tex. Penal Code § 31.03", title: "Theft", corpusType: "STATE", state: "tx", code: "tx_pe", chapter: "31", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2025-09-01", year: 2023, topics: ["theft", "property crime", "penalties"], neighbours: ["TX_PE_S31.02", "TX_PE_S31.04"], citedBy: ["TX_PE_S31.11"], crossState: ["CA_PEN_S484", "NY_PEN_S155.05"] }),
  H({ actId: "CA_CIV_S1950.5", citation: "Cal. Civ. Code § 1950.5", title: "Security deposits for residential rental", corpusType: "STATE", state: "ca", code: "ca_civ", chapter: "2", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2025-07-10", year: 2024, topics: ["landlord", "tenant", "security deposit", "rental", "entry"], neighbours: ["CA_CIV_S1950", "CA_CIV_S1951"], citedBy: ["CA_CIV_S1950.7"], crossState: ["TX_PRO_S92.103", "NY_GOB_S7-108"], defined: [["security", "Placeholder definition of a rental security deposit."]] }),
  H({ actId: "CA_LAB_S2922", citation: "Cal. Lab. Code § 2922", title: "Employment for no specified term: at-will presumption", corpusType: "STATE", state: "ca", code: "ca_lab", chapter: "2", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2025-05-20", year: 1999, topics: ["employment", "at-will", "termination notice", "notice required"], neighbours: ["CA_LAB_S2921", "CA_LAB_S2923"], citedBy: ["CA_LAB_S2924"], crossState: ["TX_LAB_S21.051"] }),
  H({ actId: "NY_GOB_S7-108", citation: "N.Y. Gen. Oblig. Law § 7-108", title: "Deposits and advance payments for rental of real property", corpusType: "STATE", state: "ny", code: "ny_gob", article: "7", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2025-06-30", year: 2019, topics: ["landlord", "tenant", "security deposit"], neighbours: ["NY_GOB_S7-107", "NY_GOB_S7-109"], crossState: ["CA_CIV_S1950.5"] }),
  H({ actId: "CA_CONST_ART1_S1", citation: "Cal. Const. art. I, § 1", title: "Inalienable rights", corpusType: "STATE_CONSTITUTION", state: "ca", article: "I", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2024-11-06", year: 2004, topics: ["rights", "privacy"], neighbours: ["CA_CONST_ART1_S2"] }),
  H({ actId: "USCONST_AMEND14", citation: "U.S. Const. amend. XIV", title: "Citizenship, due process and equal protection", corpusType: "CONSTITUTION", state: "federal", article: "Amendment XIV", actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2024-01-01", year: 1868, topics: ["due process", "equal protection"], neighbours: ["USCONST_AMEND13", "USCONST_AMEND15"] }),
];

export const hitById = (id: string) => HITS.find((h) => h.actId.toLowerCase() === id.toLowerCase());

/** Fixture record, or a deterministic placeholder for any well-formed actId (USC_T<n>_S<x>, CFR_T<n>_S<x>, <ST>_<CODE>_S<x>). Null when malformed. */
export function sectionFor(actId: string): Hit | null {
  const known = hitById(actId);
  if (known) return known;
  let m = /^(USC|CFR)_T(\d+)_S([\w.\-]+)$/i.exec(actId);
  if (m) {
    const corpus = m[1].toUpperCase(); const t = Number(m[2]);
    return { actId, citation: `${t} ${corpus === "USC" ? "U.S.C." : "C.F.R."} § ${m[3]}`, title: `Section ${m[3]} (placeholder)`, corpusType: corpus, state: "federal", titleNumber: t, actStatus: "in_force", goodLawStatus: "unknown", lastUpdated: "2025-01-06", year: 2020, topics: [], neighbours: [], citedBy: [] };
  }
  m = /^([A-Za-z]{2})_([A-Za-z]+)_S([\w.\-]+)$/.exec(actId);
  if (m) return { actId, citation: `${m[1].toUpperCase()} ${m[2].toLowerCase()} § ${m[3]}`, title: `Section ${m[3]} (placeholder)`, corpusType: "STATE", state: m[1].toLowerCase(), code: `${m[1].toLowerCase()}_${m[2].toLowerCase()}`, actStatus: "in_force", goodLawStatus: "good_law", lastUpdated: "2025-01-06", year: 2020, topics: [], neighbours: [], citedBy: [] };
  return null;
}

export const FEDERAL_CORPORA = ["USC", "CFR", "CONSTITUTION", "FEDERAL_RULES", "FEDERAL_REGISTER", "AGENCY_GUIDANCE", "SENTENCING_GUIDELINES", "US_TAX_TREATY", "EXECUTIVE_ACTION", "SESSION_LAW"];
/** `federal` means "federal corpora"; a 2-letter code means that jurisdiction. */
export const inScope = (h: Hit, state?: string) => !state || (state === "federal" ? FEDERAL_CORPORA.includes(h.corpusType) : h.state === state);

export const placeholderText = (h: Hit) => `[mock text] Placeholder body for ${h.citation}. Subsection (a) stands in for the operative rule. Subsection (b) stands in for an exception.`;
export const summary = (h: Hit, excerptChars = 500) => ({
  actId: h.actId, citation: h.citation, title: h.title, corpusType: h.corpusType, state: h.state, ...(h.code ? { code: h.code } : {}),
  actStatus: h.actStatus, goodLawStatus: h.goodLawStatus, lastUpdated: h.lastUpdated, year: h.year,
  excerpt: `[mock excerpt] ${h.title}. ${placeholderText(h)}`.slice(0, Math.max(100, excerptChars)),
  parent: { ...(h.titleNumber ? { titleNumber: h.titleNumber } : {}), ...(h.chapter ? { chapter: h.chapter } : {}), ...(h.part ? { part: h.part } : {}), ...(h.article ? { article: h.article } : {}), ...(h.code ? { code: h.code } : {}) },
  sourceUrl: `https://example.test/mock/${h.actId}`,
});

// ---- jurisdictions / coverage (counts come from the display figures already in src/data/stateBreakdown.ts)
const NAMES: Record<string, string> = { pr: "Puerto Rico", ...Object.fromEntries(jurisdictions.map((j) => [j.code.toLowerCase(), j.name])) };
export const jurisdictionName = (code: string) => NAMES[code.toLowerCase()];
const num = (s?: string) => (s && /^[\d,]+$/.test(s) ? Number(s.replace(/,/g, "")) : 0);
export const stateCounts = (code: string) => { const b = stateBreakdown[NAMES[code.toLowerCase()] ?? ""]; return b ? { statutes: num(b.s), regulations: num(b.r), constitution: num(b.c), courtRules: num(b.ct), agencyGuidance: num(b.ag), total: num(b.t) } : null; };
export const COVERED_CODES = Object.keys(NAMES);
export const FEDERAL_COUNTS: Record<string, number> = { USC: 60494, CFR: 222311, FEDERAL_REGISTER: 196816, SESSION_LAW: 425427, AGENCY_GUIDANCE: 96966, CONSTITUTION: 27, FEDERAL_RULES: 1300 };

// ---- session laws
export type SessionLaw = { id: string; jurisdiction: string; session: string; series: string; instrumentType: string; title: string; approvedOn: string; effectiveOn: string; textStatus: string; isLaw: boolean; enactmentOutcome: string; updatedAt: string; sectionsChanged: string[] };
export const SESSION_LAWS: SessionLaw[] = [
  { id: "tx-2025-HB-1", jurisdiction: "tx", session: "2025", series: "regular", instrumentType: "act", title: "An act relating to a placeholder data privacy subject", approvedOn: "2025-06-20", effectiveOn: "2025-09-01", textStatus: "complete", isLaw: true, enactmentOutcome: "enacted", updatedAt: "2025-07-02", sectionsChanged: ["TX_PE_S31.03"] },
  { id: "tx-2025-SB-14", jurisdiction: "tx", session: "2025", series: "regular", instrumentType: "act", title: "An act relating to a placeholder tenant deposit subject", approvedOn: "2025-06-13", effectiveOn: "2026-01-01", textStatus: "complete", isLaw: true, enactmentOutcome: "enacted", updatedAt: "2025-06-30", sectionsChanged: [] },
  { id: "ca-2025-AB-7", jurisdiction: "ca", session: "2025", series: "regular", instrumentType: "act", title: "An act to amend a placeholder section of the Civil Code, relating to security deposits", approvedOn: "2025-09-30", effectiveOn: "2026-01-01", textStatus: "complete", isLaw: true, enactmentOutcome: "enacted", updatedAt: "2025-10-04", sectionsChanged: ["CA_CIV_S1950.5"] },
  { id: "ca-2025-SJR-3", jurisdiction: "ca", session: "2025", series: "regular", instrumentType: "joint_resolution", title: "A joint resolution on a placeholder subject", approvedOn: "2025-08-11", effectiveOn: "2025-08-11", textStatus: "partial", isLaw: false, enactmentOutcome: "enacted", updatedAt: "2025-08-12", sectionsChanged: [] },
  { id: "ny-2025-S-2201", jurisdiction: "ny", session: "2025", series: "regular", instrumentType: "act", title: "An act to amend the general obligations law, relating to deposits", approvedOn: "2025-12-02", effectiveOn: "2026-03-02", textStatus: "complete", isLaw: true, enactmentOutcome: "enacted", updatedAt: "2025-12-05", sectionsChanged: ["NY_GOB_S7-108"] },
  { id: "ny-2025-A-9", jurisdiction: "ny", session: "2025", series: "special", instrumentType: "act", title: "A placeholder act that was vetoed", approvedOn: "2025-11-01", effectiveOn: "2025-11-01", textStatus: "missing", isLaw: false, enactmentOutcome: "vetoed", updatedAt: "2025-11-02", sectionsChanged: [] },
];
export const lawById = (id: string) => SESSION_LAWS.find((l) => l.id.toLowerCase() === id.toLowerCase());
export const lawText = (l: SessionLaw) => `[mock text] ${l.title}. Be it enacted: Section 1. Placeholder text of the act as passed. [struck: placeholder deleted words] Section 2. This act takes effect ${l.effectiveOn}.`;
export const mockSha = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return `mock${h.toString(16).padStart(8, "0").repeat(8)}`; };
