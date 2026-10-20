// MOCK / DISPLAY DATA for the Acts & Judgments browser (/workspace/browse).
//
// WHAT IS REAL vs MOCKED (see docs/ACTS-AND-JUDGMENTS.md):
// - Headline figures, the six court counts marked `seen` and the layout come from a screenshot of the original authenticated app supplied by the
//   project owner. They are display figures, not data held here.
// - The acts list shape (ActListItem: actId, title, year, category, department, actNumber, actStatus, enactmentDate, citation, sectionCount) is the
//   response shape published in the public API docs for GET /in/acts/list. The ROWS below are invented placeholders: real act titles and years, but
//   ids are MOCK_*, section counts are placeholders and no text of any act is included.
// - The original app's own data source for judgments, and its network calls, were NOT observed (login required and unavailable). Nothing here
//   claims to be, or to come from, that corpus.

export const BROWSE_STATS = { acts: "64,179", sections: "7,45,970", judgments: "11.7M+", highCourts: 25, tribunals: 14 };

export type Court = { slug: string; name: string; count: string | null; seen: boolean };
const c = (name: string, count: string | null = null): Court => ({ slug: name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), name, count, seen: count !== null });

export const SUPREME_COURT: Court = { slug: "supreme-court-of-india", name: "Supreme Court of India", count: "~41,000", seen: true };
// The 25 High Courts, alphabetical. Counts exist only for the six that were visible in the reference screenshot; the rest are left unknown on purpose.
export const HIGH_COURTS: Court[] = [
  c("Allahabad High Court", "~18,00,000"), c("Andhra Pradesh High Court", "~3,50,000"), c("Bombay High Court", "~9,00,000"), c("Calcutta High Court", "~6,00,000"),
  c("Chhattisgarh High Court", "~2,50,000"), c("Delhi High Court", "~8,00,000"), c("Gauhati High Court"), c("Gujarat High Court"), c("Himachal Pradesh High Court"),
  c("High Court of Jammu & Kashmir and Ladakh"), c("Jharkhand High Court"), c("Karnataka High Court"), c("Kerala High Court"), c("Madhya Pradesh High Court"),
  c("Madras High Court"), c("Manipur High Court"), c("Meghalaya High Court"), c("Orissa High Court"), c("Patna High Court"), c("Punjab & Haryana High Court"),
  c("Rajasthan High Court"), c("Sikkim High Court"), c("Telangana High Court"), c("Tripura High Court"), c("Uttarakhand High Court"),
];
export const ALL_COURTS = [SUPREME_COURT, ...HIGH_COURTS];

/** Years offered on a court page, newest first, grouped by decade (the reference shows decade groups down to the 1970s and below). */
export const YEAR_RANGE = { from: 2025, to: 1950 };
export const decades = () => {
  const out: { label: string; years: number[] }[] = [];
  for (let d = Math.floor(YEAR_RANGE.from / 10) * 10; d >= Math.floor(YEAR_RANGE.to / 10) * 10; d -= 10) {
    const years: number[] = [];
    for (let y = Math.min(d + 9, YEAR_RANGE.from); y >= Math.max(d, YEAR_RANGE.to); y--) years.push(y);
    out.push({ label: `${d}s`, years });
  }
  return out;
};

// ---- acts (mock rows, public response shape)
/** `year` is null only for real acts whose year is missing in the dataset; `sectionCount` 0 on real data means "not countable" (no section numbers in the data). */
export type ActItem = { actId: string; title: string; year: number | null; category: "central" | "state" | "regulatory"; state?: string; department?: string; actNumber?: string; actStatus: "in_force" | "repealed" | "superseded" | "spent"; enactmentDate?: string; citation: string; sectionCount: number };
const a = (n: number, title: string, year: number, category: ActItem["category"], actStatus: ActItem["actStatus"], extra: Partial<ActItem> = {}): ActItem =>
  ({ actId: `MOCK_${String(n).padStart(4, "0")}`, title, year, category, actStatus, citation: title, sectionCount: 20 + ((n * 37) % 180), ...extra });
export const MOCK_ACTS: ActItem[] = [
  a(1, "The Digital Personal Data Protection Act, 2023", 2023, "central", "in_force"),
  a(2, "The Bharatiya Nyaya Sanhita, 2023", 2023, "central", "in_force"),
  a(3, "The Consumer Protection Act, 2019", 2019, "central", "in_force"),
  a(4, "The Companies Act, 2013", 2013, "central", "in_force"),
  a(5, "The Right to Information Act, 2005", 2005, "central", "in_force"),
  a(6, "The Information Technology Act, 2000", 2000, "central", "in_force"),
  a(7, "The Indian Contract Act, 1872", 1872, "central", "in_force"),
  a(8, "The Indian Penal Code, 1860", 1860, "central", "repealed"),
  a(9, "The Code of Criminal Procedure, 1973", 1973, "central", "repealed"),
  a(10, "The Maharashtra Rent Control Act, 1999", 1999, "state", "in_force", { state: "maharashtra" }),
  a(11, "The Karnataka Shops and Commercial Establishments Act, 1961", 1961, "state", "in_force", { state: "karnataka" }),
  a(12, "The Delhi Rent Control Act, 1958", 1958, "state", "in_force", { state: "delhi" }),
  a(13, "The Tamil Nadu Shops and Establishments Act, 1947", 1947, "state", "in_force", { state: "tamil-nadu" }),
  a(14, "The Uttar Pradesh Urban Buildings (Regulation of Letting, Rent and Eviction) Act, 1972", 1972, "state", "in_force", { state: "uttar-pradesh" }),
  a(15, "SEBI (Listing Obligations and Disclosure Requirements) Regulations, 2015", 2015, "regulatory", "in_force", { department: "sebi" }),
  a(16, "SEBI (Prohibition of Insider Trading) Regulations, 2015", 2015, "regulatory", "in_force", { department: "sebi" }),
  a(17, "Master Direction on Digital Lending (RBI)", 2025, "regulatory", "in_force", { department: "rbi" }),
];
export const ACT_CATEGORIES = ["central", "state", "regulatory"] as const;
export const ACT_STATUSES = ["in_force", "repealed", "superseded", "spent"] as const;
