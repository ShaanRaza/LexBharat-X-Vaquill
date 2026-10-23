// GET /api/acts/stats: headline counts, the filter values that exist, attribution and data caveats for the acts browser.
import { getActsStore } from "@/lib/acts";
import { dbConfigured } from "@/lib/acts/db";
import { actsTextDir } from "@/lib/acts/sectionText";

export async function GET() {
  // sectionText: whether this deployment can show section text and search it (Neon or local files); the page words its notice from this.
  return Response.json({ ...(await getActsStore().stats()), sectionText: dbConfigured() || !!actsTextDir() }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
