// GET /api/acts/stats: headline counts, the filter values that exist, attribution and data caveats for the acts browser.
import { getActsStore, sectionTextAvailable } from "@/lib/legal-data";

export async function GET() {
  // sectionText: whether this deployment can show section text and search it; the page words its notice from this.
  return Response.json({ ...(await getActsStore().stats()), sectionText: sectionTextAvailable() }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
