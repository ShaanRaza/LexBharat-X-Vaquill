// GET /api/drafting/<id> -> the draft (with its version list); PUT {doc} autosaves the latest edit; PATCH {title} renames; DELETE removes it. Only the browser that made a draft can touch it.
import { dbConfigured } from "@/lib/acts/db";
import { validDoc } from "@/lib/drafting/docmodel.mjs";
import { bidOf, json } from "@/lib/drafting/http";
import { deleteDraft, getDraft, isDraftId, listVersions, MAX_DOC_BYTES, renameDraft, saveEdit } from "@/lib/drafting/store";

type Ctx = { params: Promise<{ id: string }> };
const auth = async (req: Request, ctx: Ctx) => { const { id } = await ctx.params, bid = bidOf(req); return bid && isDraftId(id) && dbConfigured() ? { id, bid } : null; };
const gone = () => json({ error: "Draft not found." }, 404);

export async function GET(req: Request, ctx: Ctx) {
  const a = await auth(req, ctx); if (!a) return gone();
  const d = await getDraft(a.bid, a.id).catch(() => null); if (!d) return gone();
  return json({ ...d, versions: await listVersions(a.id).catch(() => []) });
}
export async function PUT(req: Request, ctx: Ctx) {
  const a = await auth(req, ctx); if (!a) return gone();
  const raw = await req.text();
  if (raw.length > MAX_DOC_BYTES) return json({ error: "The draft is too large to save." }, 413);
  let body: { doc?: unknown } | null = null; try { body = JSON.parse(raw); } catch { /* handled below */ }
  if (!validDoc(body?.doc)) return json({ error: "That is not a valid draft." }, 422);
  const at = await saveEdit(a.bid, a.id, body!.doc as never).catch(() => null);
  return at ? json({ ok: true, savedAt: at }) : gone();
}
export async function PATCH(req: Request, ctx: Ctx) {
  const a = await auth(req, ctx); if (!a) return gone();
  const body = (await req.json().catch(() => null)) as { title?: unknown } | null, t = typeof body?.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
  if (t.length < 2) return json({ error: "Give the draft a title (at least 2 characters)." }, 422);
  return (await renameDraft(a.bid, a.id, t).catch(() => false)) ? json({ ok: true }) : gone();
}
export async function DELETE(req: Request, ctx: Ctx) {
  const a = await auth(req, ctx); if (!a) return gone();
  return (await deleteDraft(a.bid, a.id).catch(() => false)) ? json({ ok: true }) : gone();
}
