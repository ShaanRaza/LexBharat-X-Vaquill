// GET /api/quickfind?q=<what was typed> -> { kind, number, laws, judgments } for Quick-find. `laws` are sections or Articles NUMBERED the typed number (a bare "138", or "138 NI", "NI 138", "s.138 NI Act"), best-known first;
// `judgments` are Supreme Court cases for the words typed, where a number may match only a case number or a full citation, never a report page number ("8 S.C.R. 138"). Exact words only: no search by meaning, no Voyage.
import { numberedLaws } from "@/lib/acts/quickLaws";
import { getJudgmentsStore } from "@/lib/judgments";
import { searchSupremeCourt } from "@/lib/judgments/scSearch";
import { numericOk } from "@/lib/quickfind/rank.mjs";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 100) return Response.json({ error: "q must be 2 to 100 characters." }, { status: 422 });
  const [laws, sc] = await Promise.all([numberedLaws(q).catch(() => ({ kind: "text" as const, number: null, hits: [] })), getJudgmentsStore().source === "mock" ? Promise.resolve({ results: [] }) : searchSupremeCourt(q, 1, 500).catch(() => ({ results: [] }))]);
  const judgments = sc.results.filter((h) => numericOk(q, h)).slice(0, 5);
  return Response.json({ kind: laws.kind, number: laws.number, laws: laws.hits, judgments }, { headers: { "Cache-Control": "no-store" } });
}
