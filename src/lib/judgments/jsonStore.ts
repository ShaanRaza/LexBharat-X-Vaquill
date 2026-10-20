// Phase 2 store: judgment METADATA from the open-india-law snapshot (CC BY 4.0), exported by scripts/judgments/export-judgments.sh into src/data/judgments/.
//  - court-years.json / courts.meta.json: distinct case_id per court and decision year (all 26 courts, aggregates only).
//  - sc/<year>.json: one row per Supreme Court case, loaded lazily per year. No text, no chunks, nothing ordered or concatenated.
// The raw dataset is never read at runtime. Swap in a Postgres/S3 store behind the same JudgmentsStore interface when High Court case lists are added.
import courtYears from "@/data/judgments/court-years.json";
import courtsMeta from "@/data/judgments/courts.meta.json";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { HC_PAGE_SIZE, hcSourceKind, readHcPage } from "./hcData";
import type { CaseItem, CourtSummary, JudgmentsStore, YearCount } from "./types";

const SC = "supreme-court-of-india";
type Row = { court: string; year: number; cases: number };
const byCourt = new Map<string, YearCount[]>();
for (const r of courtYears as Row[]) { const a = byCourt.get(r.court) ?? []; a.push({ year: r.year, cases: r.cases }); byCourt.set(r.court, a); }
for (const a of byCourt.values()) a.sort((x, y) => y.year - x.year);

const BASE_COURTS = ALL_COURTS.map((c) => {
  const m = (courtsMeta as { court: string; cases: number; first_year: number | null; last_year: number | null }[]).find((x) => x.court === c.slug);
  return { slug: c.slug, name: c.name, cases: m?.cases ?? null, firstYear: m?.first_year ?? null, lastYear: m?.last_year ?? null };
});
// Supreme Court cases are bundled (src/data/judgments/sc). High Court pages live outside the bundle (see hcData.ts) and are listable only when a data source is configured.
const courts = (): CourtSummary[] => BASE_COURTS.map((c) => ({ ...c, listable: c.slug === SC || hcSourceKind() !== null, searchable: c.slug === SC, filterable: c.slug === SC }));
const TOTAL = BASE_COURTS.reduce((n, c) => n + (c.cases ?? 0), 0);

async function scYear(year: number): Promise<CaseItem[]> {
  if (!Number.isInteger(year) || !byCourt.get(SC)?.some((y) => y.year === year)) return [];
  const rows = (await import(`@/data/judgments/sc/${year}.json`)).default as Record<string, unknown>[];
  // The export is oldest first; the product shows newest first (same order the High Court pages use).
  return rows.map((r) => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[k] = v; return o as unknown as CaseItem; }).reverse();
}

export const jsonJudgmentsStore: JudgmentsStore = {
  source: "real",
  async courts() { return courts(); },
  async years(court) { return byCourt.get(court) ?? (BASE_COURTS.some((c) => c.slug === court) ? [] : null); },
  async list(court, q) {
    if (court === SC) {
      const needle = q.search?.toLowerCase();
      const year = await scYear(q.year);
      // Facet counts describe the whole year (before the search and filters), like a normal faceted list.
      const counts = new Map<string, number>(); for (const c of year) if (c.disposition) counts.set(c.disposition, (counts.get(c.disposition) ?? 0) + 1);
      const facets = { disposition: [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) };
      const all = year.filter((c) => (!needle || [c.title, c.citation, c.petitioner, c.respondent].some((f) => f?.toLowerCase().includes(needle))) && (!q.disposition || c.disposition === q.disposition));
      const start = (q.page - 1) * q.pageSize;
      return { available: true, results: all.slice(start, start + q.pageSize), total: all.length, facets };
    }
    if (hcSourceKind() === null) return { available: false, results: [], total: 0 };
    const total = byCourt.get(court)?.find((y) => y.year === q.year)?.cases ?? 0;
    const start = (q.page - 1) * q.pageSize, end = Math.min(start + q.pageSize, total);
    if (start >= total) return { available: true, results: [], total };
    // A request spans at most two 100-case pages (pageSize <= 100).
    const first = Math.floor(start / HC_PAGE_SIZE) + 1, last = Math.floor((end - 1) / HC_PAGE_SIZE) + 1, rows: CaseItem[] = [];
    for (let p = first; p <= last; p++) { const pg = await readHcPage(court, q.year, p); if (!pg) return { available: false, results: [], total }; rows.push(...pg); }
    const off = start - (first - 1) * HC_PAGE_SIZE;
    return { available: true, results: rows.slice(off, off + (end - start)), total };
  },
  async get(court, year, caseId, pageHint) {
    if (court === SC) return (await scYear(year)).find((c) => c.caseId === caseId) ?? null;
    if (hcSourceKind() === null || !pageHint) return null;
    return (await readHcPage(court, year, pageHint))?.find((c) => c.caseId === caseId) ?? null;
  },
  async stats() {
    const hc = hcSourceKind() !== null;
    return {
      source: "real", totalCases: TOTAL, courts: BASE_COURTS.length, listableCourts: hc ? BASE_COURTS.length : 1,
      caveats: [
        "Counts are distinct case records in the dataset, not official case totals. Coverage is uneven: several High Courts start around 2015.",
        hc ? "Case lists are available for the Supreme Court and every High Court, by year. Only Supreme Court cases can be searched inside a year. Judgment text is not available yet."
           : "Only Supreme Court cases can be listed so far. High Courts show counts by year. Judgment text is not available yet.",
        "Years follow the decision date where present. Records with no usable date or year are left out of the lists.",
        "High Courts rarely carry a reporter citation, so the case number is the main identifier. Party names are as extracted from the judgment and can be incomplete or missing.",
        "Judges and bench size are shown only for Bombay, Gujarat and Orissa and only when every name on the case checks out. Other courts' judge data is unreliable, so it is left out. Short text previews are not available yet.",
      ],
      attribution: { text: "Data: open-india-law (Vaquill), built from public court judgments. Source acknowledgment: eCourts and the Supreme Court of India; source PDFs published by Dattam Labs (CC BY 4.0).", url: "https://huggingface.co/datasets/vaquill/open-india-law", licence: "CC BY 4.0", snapshot: "v2026.08" },
    };
  },
};
