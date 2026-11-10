export type JudgmentsSource = "real" | "mock";
/** One case, metadata only. High Court rows carry only HC_FIELDS (src/lib/judgments/hcRecord.mjs): no parties, judges or bench, ever. */
export type CaseItem = {
  caseId: string; title: string; citation?: string; disposition?: string; decisionDate?: string;
  /** Supreme Court only. High Court rows never carry these (docs/JUDGMENTS-HC.md). */
  petitioner?: string; respondent?: string; benchStrength?: number; judges?: string[];
  /** High Courts: the party title ("A KUMAR Vs THE STATE"), cleaned by cleanTitle() (displayTitle.mjs). Present only for courts named in HC_DISPLAY_TITLE_COURTS. */
  displayTitle?: string;
  /** High Courts: read from the title ("WP/933/2024" gives "933/2024"). */
  caseNumber?: string;
  /** High Courts: the case number as recorded in the dataset. It disagrees with the title on about 36% of cases; exact search matches either. */
  caseNumberRecorded?: string;
  /** As recorded in the source (High Courts: dd-mm-yyyy). */
  dateOfRegistration?: string;
  /** High Courts: normalized chip text for the ~20 common dispositions (Allowed, Dismissed, Disposed of...); absent for the other spellings. */
  dispositionLabel?: string;
  /** Supreme Court, extracted from the report heading "[A and B, JJ.]" (scripts/judgments/extract-sc-fields.py): the full bench, only when every name checks out. `judges` stays the dataset's authoring judge. */
  benchExtracted?: string[];
  /** Supreme Court, extracted from the heading "(Criminal Appeal No. 512 of 2020)" when the pattern matches cleanly. */
  caseNumberExtracted?: string;
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
  /** true when search works for this court: Supreme Court by party name or case number, always; High Courts by case number or year, when the search index is present (hcSearch.ts). */
  searchable: boolean;
  /** true when in-year filters (disposition) work: Supreme Court only. High Court years are read one 100-case page at a time, so a filter would need every page of the year. */
  filterable: boolean;
};
export type YearCount = { year: number; cases: number | null };
export type CaseQuery = { year: number; page: number; pageSize: number; search: string | null; disposition?: string | null };
export type Facet = { value: string; count: number };
export type JudgmentsStats = { source: JudgmentsSource; totalCases: number | null; courts: number; listableCourts: number; caveats: string[]; attribution?: { text: string; url: string; licence: string; snapshot: string } };
/** The interface routes and pages depend on. The Phase 2 JSON store and the mock store implement it; a Postgres/S3 store can replace them later. */
export interface JudgmentsStore {
  readonly source: JudgmentsSource;
  courts(): Promise<CourtSummary[]>;
  years(court: string): Promise<YearCount[] | null>;
  list(court: string, q: CaseQuery): Promise<{ available: boolean; results: CaseItem[]; total: number; facets?: { disposition: Facet[] } }>;
  /** One case. `pageHint` is the 100-case page number carried in the link (High Courts); the Supreme Court ignores it. */
  get(court: string, year: number, caseId: string, pageHint?: number): Promise<CaseItem | null>;
  stats(): Promise<JudgmentsStats>;
  /** Opening text of one case (Supreme Court only; null when there is none or no data source is configured). */
  preview(court: string, year: number, caseId: string): Promise<string | null>;
}
