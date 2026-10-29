// Picks the active judgments store. JUDGMENTS_SOURCE=mock forces the placeholder court pages (kill switch); anything else serves the real Phase 2 data.
// Server-only: import from route handlers and server components.
import { jsonJudgmentsStore } from "./jsonStore";
import { mockJudgmentsStore } from "./mockStore";
import type { JudgmentsStore } from "./types";

import { caseTitle } from "@/lib/docs/docType.mjs";
import type { CaseItem } from "./types";

// Case names leave the store tidy ("A versus ." -> "A"): every list, case page and search reads titles from here.
const party = (v?: string) => (v && /[A-Za-z0-9]/.test(v) ? v : undefined);   // a party recorded as "." or "-" is a missing party
const tidy = (c: CaseItem): CaseItem => (c ? { ...c, ...(typeof c.title === "string" ? { title: caseTitle(c.title) } : {}), petitioner: party(c.petitioner), respondent: party(c.respondent) } : c);
const wrap = (s: JudgmentsStore): JudgmentsStore => ({
  get source() { return s.source; }, courts: () => s.courts(), years: (c) => s.years(c), stats: () => s.stats(), preview: (a, b, c) => s.preview(a, b, c),
  list: async (c, q) => { const r = await s.list(c, q); return { ...r, results: r.results.map(tidy) }; },
  get: async (c, y, id, p) => { const r = await s.get(c, y, id, p); return r ? tidy(r) : r; },
});
export const getJudgmentsStore = (): JudgmentsStore => wrap(process.env.JUDGMENTS_SOURCE === "mock" || process.env.ACTS_SOURCE === "mock" ? mockJudgmentsStore : jsonJudgmentsStore);
export type * from "./types";
