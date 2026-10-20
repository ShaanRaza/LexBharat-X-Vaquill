export type JudgmentsSource = "real" | "mock";
/** One Supreme Court case, metadata only. No judgment text is held or served in this phase. */
export type CaseItem = {
  caseId: string; title: string; citation?: string; disposition?: string; decisionDate?: string;
  petitioner?: string; respondent?: string; caseNumber?: string; benchStrength?: number; judges?: string[];
  /** As recorded in the source (High Courts: dd-mm-yyyy). */
  dateOfRegistration?: string;
  /** High Courts: normalized chip text for the ~20 common dispositions (Allowed, Dismissed, Disposed of...); absent for the other spellings. */
  dispositionLabel?: string;
  /** High Courts, only where the judge list passed the name check (Bombay, Gujarat, Orissa): number of judges named. */
  benchSize?: number;
  /** Pages of extracted text (the last page the text reaches). */
  pages?: number;
  /** High Court filtered lists only: the page of the unfiltered list that holds this case (the detail link needs it). */
  mainPage?: number;
};
export type CourtSummary = {
  slug: string; name: string;
  /** Distinct case records in the dataset (case_id), or null when unknown (mock). */
  cases: number | null; firstYear: number | null; lastYear: number | null;
  /** true when individual cases can be listed (Supreme Court only for now); other courts have counts by year only. */
  listable: boolean;
  /** true when text search inside a year works (Supreme Court only; High Court pages are read one 100-case page at a time). */
  searchable: boolean;
  /** true when in-year filters (disposition) work: Supreme Court only. High Court years are read one 100-case page at a time, so a filter would need every page of the year. */
  filterable: boolean;
};
export type YearCount = { year: number; cases: number | null };
export type CaseQuery = { year: number; page: number; pageSize: number; search: string | null; disposition?: string | null; bench?: string | null };
export type Facet = { value: string; count: number };
export type JudgmentsStats = { source: JudgmentsSource; totalCases: number | null; courts: number; listableCourts: number; caveats: string[]; attribution?: { text: string; url: string; licence: string; snapshot: string } };
/** The interface routes and pages depend on. The Phase 2 JSON store and the mock store implement it; a Postgres/S3 store can replace them later. */
export interface JudgmentsStore {
  readonly source: JudgmentsSource;
  courts(): Promise<CourtSummary[]>;
  years(court: string): Promise<YearCount[] | null>;
  list(court: string, q: CaseQuery): Promise<{ available: boolean; results: CaseItem[]; total: number; facets?: { disposition: Facet[]; bench?: Facet[] } }>;
  /** One case. `pageHint` is the 100-case page number carried in the link (High Courts); the Supreme Court ignores it. */
  get(court: string, year: number, caseId: string, pageHint?: number): Promise<CaseItem | null>;
  stats(): Promise<JudgmentsStats>;
}
