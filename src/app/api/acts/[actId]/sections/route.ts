// GET /api/acts/<actId>/sections: section text for one act. Always { available: false } in this phase (see src/lib/sections). 404 for an unknown act.
import { getActsStore, getSectionsStore } from "@/lib/legal-data";

export async function GET(_req: Request, { params }: { params: Promise<{ actId: string }> }) {
  const { actId } = await params;
  const act = await getActsStore().get(actId);
  if (!act) return Response.json({ error: "Unknown act." }, { status: 404 });
  return Response.json({ actId, ...(await getSectionsStore().get(actId)), sectionCount: act.sectionCount }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
