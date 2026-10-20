// Phase 2 store: judgment METADATA from the open-india-law snapshot (CC BY 4.0), exported by scripts/judgments/export-judgments.sh into src/data/judgments/.
//  - court-years.json / courts.meta.json: distinct case_id per court and decision year (all 26 courts, aggregates only).
//  - sc/<year>.json: one row per Supreme Court case, loaded lazily per year. No text, no chunks, nothing ordered or concatenated.
// The raw dataset is never read at runtime. Swap in a Postgres/S3 store behind the same JudgmentsStore interface when High Court case lists are added.
import courtYears from "@/data/judgments/court-years.json";
import courtsMeta from "@/data/judgments/courts.meta.json";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import type { CaseItem, CourtSummary, JudgmentsStore, YearCount } from "./types";

const SC = "supreme-court-of-india";
type Row = { court: string; year: number; cases: number };
const byCourt = new Map<string, YearCount[]>();
for (const r of courtYears as Row[]) { const a = byCourt.get(r.court) ?? []; a.push({ year: r.year, cases: r.cases }); byCourt.set(r.court, a); }
for (const a of byCourt.values()) a.sort((x, y) => y.year - x.year);

const COURTS: CourtSummary[] = ALL_COURTS.map((c) => {
  const m = (courtsMeta as { court: string; cases: number; first_year: number | null; last_year: number | null }[]).find((x) => x.court === c.slug);
  return { slug: c.slug, name: c.name, cases: m?.cases ?? null, firstYear: m?.first_year ?? null, lastYear: m?.last_year ?? null, listable: c.slug === SC };
});
const TOTAL = COURTS.reduce((n, c) => n + (c.cases ?? 0), 0);

async function scYear(year: number): Promise<CaseItem[]> {
  if (!Number.isInteger(year) || !byCourt.get(SC)?.some((y) => y.year === year)) return [];
  const rows = (await import(`@/data/judgments/sc/${year}.json`)).default as Record<string, unknown>[];
  return rows.map((r) => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[k] = v; return o as unknown as CaseItem; });
}

export const jsonJudgmentsStore: JudgmentsStore = {
  source: "real",
  async courts() { return COURTS; },
  async years(court) { return byCourt.get(court) ?? (COURTS.some((c) => c.slug === court) ? [] : null); },
  async list(court, q) {
    if (court !== SC) return { available: false, results: [], total: 0 };
    const needle = q.search?.toLowerCase();
    const all = (await scYear(q.year)).filter((c) => !needle || [c.title, c.citation, c.petitioner, c.respondent].some((f) => f?.toLowerCase().includes(needle)));
    const start = (q.page - 1) * q.pageSize;
    return { available: true, results: all.slice(start, start + q.pageSize), total: all.length };
  },
  async stats() {
    return {
      source: "real", totalCases: TOTAL, courts: COURTS.length, listableCourts: 1,
      caveats: [
        "Counts are distinct case records in the dataset, not official case totals. Coverage is uneven: several High Courts start around 2015.",
        "Only Supreme Court cases can be listed so far. High Courts show counts by year. Judgment text is not available yet.",
        "Years follow the decision date where present. Some records have no usable year and are left out of the year lists.",
      ],
      attribution: { text: "Data: open-india-law (Vaquill), built from public court judgments. Source acknowledgment: eCourts and the Supreme Court of India; source PDFs published by Dattam Labs (CC BY 4.0).", url: "https://huggingface.co/datasets/vaquill/open-india-law", licence: "CC BY 4.0", snapshot: "v2026.08" },
    };
  },
};
