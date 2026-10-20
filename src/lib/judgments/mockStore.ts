// Fallback store (JUDGMENTS_SOURCE=mock): the display data in src/data/workspaceBrowse.ts. No counts per year, no cases.
import { ALL_COURTS, YEAR_RANGE } from "@/data/workspaceBrowse";
import type { JudgmentsStore } from "./types";

export const mockJudgmentsStore: JudgmentsStore = {
  source: "mock",
  async courts() { return ALL_COURTS.map((c) => ({ slug: c.slug, name: c.name, cases: null, firstYear: null, lastYear: null, listable: false, searchable: false })); },
  async years(court) {
    if (!ALL_COURTS.some((c) => c.slug === court)) return null;
    return Array.from({ length: YEAR_RANGE.from - YEAR_RANGE.to + 1 }, (_, i) => ({ year: YEAR_RANGE.from - i, cases: null }));
  },
  async list() { return { available: false, results: [], total: 0 }; },
  async get() { return null; },
  async stats() { return { source: "mock", totalCases: null, courts: ALL_COURTS.length, listableCourts: 0, caveats: ["Placeholder court pages. No judgments are held."] }; },
};
