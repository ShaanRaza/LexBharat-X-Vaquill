// GET /api/judgments/courts: every court with its case-record count (real) or null (mock), plus stats, caveats and attribution.
import { getJudgmentsStore } from "@/lib/judgments";

export async function GET() {
  const store = getJudgmentsStore();
  return Response.json({ source: store.source, stats: await store.stats(), courts: await store.courts() }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
