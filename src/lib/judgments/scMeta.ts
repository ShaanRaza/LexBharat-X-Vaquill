// Case record (title, citation, date, year file) for a Supreme Court case id. The id's year can differ from the year file the case sits in (26 cases), so the neighbouring years are tried. Server-only.
import { getJudgmentsStore } from "./index";
import type { CaseItem } from "./types";

export const SC = "supreme-court-of-india";
export async function scCase(caseId: string): Promise<{ year: number; c: CaseItem } | null> {
  const y = Number(caseId.slice(0, 4)), store = getJudgmentsStore();
  for (const yr of [y, y + 1, y - 1]) { const c = await store.get(SC, yr, caseId).catch(() => null); if (c) return { year: yr, c }; }
  return null;
}
