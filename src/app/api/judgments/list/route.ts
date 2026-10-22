// GET /api/judgments/list?court=<slug>&year=<yyyy>&page&pageSize&search: case METADATA for one court and year. Supreme Court and High Courts are listable;
// High Courts answer { available: false } only while no case-page source is configured (docs/JUDGMENTS-HC.md). No judgment text is served.
import { getJudgmentsStore } from "@/lib/judgments";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, get = (k: string) => q.get(k)?.trim() || null;
  const court = get("court"), year = Number(get("year")), page = Number(get("page") ?? 1), pageSize = Number(get("pageSize") ?? 25), search = get("search");
  const bad = (error: string) => Response.json({ error }, { status: 422 });
  if (!court) return bad("court is required.");
  if (!Number.isInteger(year) || year < 1900 || year > 2026) return bad("year must be an integer from 1900 to 2026.");
  if (![page, pageSize].every(Number.isInteger) || page < 1 || pageSize < 1 || pageSize > 100) return bad("page must be >= 1 and pageSize 1 to 100.");
  if (search && (search.length < 2 || search.length > 200)) return bad("search must be 2 to 200 characters.");
  const store = getJudgmentsStore();
  if (!(await store.courts()).some((c) => c.slug === court)) return bad("Unknown court: use one of the court slugs from /api/judgments/courts.");
  const summary = (await store.courts()).find((c) => c.slug === court);
  if (search && court !== "supreme-court-of-india") return bad("High Court search is served by /api/judgments/search-hc.");
  const disposition = get("disposition"), bench = get("bench");
  if ((disposition || bench) && !summary?.filterable) return bad("Filters are not available for this court yet.");
  if (bench && court === "supreme-court-of-india") return bad("Bench size is not available for the Supreme Court.");
  if (disposition && bench) return bad("Use one filter at a time: disposition or bench.");
  if (bench && !["single", "division", "larger"].includes(bench)) return bad("bench must be single, division or larger.");
  const { available, results, total, facets } = await store.list(court, { year, page, pageSize, search, disposition, bench });
  return Response.json({ source: store.source, available, searchable: !!summary?.searchable, filterable: !!summary?.filterable, ...(facets ? { facets } : {}), court, year, results, total, page, pageSize, hasMore: (page - 1) * pageSize + pageSize < total,
    note: available ? "Case metadata from the open-india-law dataset (CC BY 4.0). No judgment text." : "Case lists are not available for this court yet." },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
