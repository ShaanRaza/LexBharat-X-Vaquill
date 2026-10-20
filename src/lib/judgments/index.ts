// Picks the active judgments store. JUDGMENTS_SOURCE=mock forces the placeholder court pages (kill switch); anything else serves the real Phase 2 data.
// Server-only: import from route handlers and server components.
import { jsonJudgmentsStore } from "./jsonStore";
import { mockJudgmentsStore } from "./mockStore";
import type { JudgmentsStore } from "./types";

export const getJudgmentsStore = (): JudgmentsStore => (process.env.JUDGMENTS_SOURCE === "mock" || process.env.ACTS_SOURCE === "mock" ? mockJudgmentsStore : jsonJudgmentsStore);
export type * from "./types";
