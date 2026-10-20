// GET /api/acts/stats: headline counts, the filter values that exist, attribution and data caveats for the acts browser.
import { getActsStore } from "@/lib/acts";

export async function GET() {
  return Response.json(await getActsStore().stats(), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
