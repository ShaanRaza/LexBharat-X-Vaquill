// GET /api/judgments/case?court=<slug>&year=<yyyy>&id=<caseId>&p=<page>: one case's metadata. `p` is the 100-case page the list link carried (High Courts only).
import { getJudgmentsStore } from "@/lib/legal-data";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, court = q.get("court")?.trim() ?? "", id = q.get("id")?.trim() ?? "", year = Number(q.get("year")), p = q.get("p") ? Number(q.get("p")) : undefined;
  if (!court || !id || !Number.isInteger(year) || year < 1900 || year > 2026 || (p !== undefined && (!Number.isInteger(p) || p < 1))) return Response.json({ error: "court, year (1900-2026) and id are required." }, { status: 422 });
  const store = getJudgmentsStore(), c = await store.get(court, year, id, p);
  if (!c) return Response.json({ error: "Case not found." }, { status: 404 });
  return Response.json({ source: store.source, court, year, case: c, note: "Case metadata from the open-india-law dataset (CC BY 4.0). No judgment text." }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
