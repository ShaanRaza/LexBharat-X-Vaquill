// GET /api/judgments/years?court=<slug>: case-record count per decision year for one court.
import { getJudgmentsStore } from "@/lib/legal-data";

export async function GET(req: Request) {
  const court = new URL(req.url).searchParams.get("court")?.trim() ?? "";
  const store = getJudgmentsStore(), years = court ? await store.years(court) : null;
  if (!years) return Response.json({ error: "Unknown court." }, { status: 404 });
  return Response.json({ source: store.source, court, years }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
