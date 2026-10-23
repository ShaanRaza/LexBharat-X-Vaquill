// GET -> version list. POST {action:"save"} keeps a named snapshot of the current text; POST {action:"restore", versionId} puts an older version back (the current text is kept first as "before-restore").
import { dbConfigured } from "@/lib/acts/db";
import { bidOf, json } from "@/lib/drafting/http";
import { addVersion, getDraft, getVersionDoc, isDraftId, listVersions, saveEdit } from "@/lib/drafting/store";

type Ctx = { params: Promise<{ id: string }> };
async function open(req: Request, ctx: Ctx) { const { id } = await ctx.params, bid = bidOf(req); if (!bid || !isDraftId(id) || !dbConfigured()) return null; const d = await getDraft(bid, id).catch(() => null); return d ? { id, bid, d } : null; }

export async function GET(req: Request, ctx: Ctx) {
  const o = await open(req, ctx); if (!o) return json({ error: "Draft not found." }, 404);
  return json({ versions: await listVersions(o.id), latestEditAt: o.d.updatedAt });
}
export async function POST(req: Request, ctx: Ctx) {
  const o = await open(req, ctx); if (!o) return json({ error: "Draft not found." }, 404);
  const body = (await req.json().catch(() => null)) as { action?: unknown; versionId?: unknown } | null;
  if (body?.action === "save") { await addVersion(o.id, "saved", o.d.doc); return json({ ok: true, versions: await listVersions(o.id) }); }
  if (body?.action === "restore" && Number.isInteger(body.versionId)) {
    const doc = await getVersionDoc(o.id, body.versionId as number); if (!doc) return json({ error: "Version not found." }, 404);
    await addVersion(o.id, "before-restore", o.d.doc); await saveEdit(o.bid, o.id, doc);
    return json({ ok: true, doc, versions: await listVersions(o.id) });
  }
  return json({ error: "Unknown action." }, 422);
}
