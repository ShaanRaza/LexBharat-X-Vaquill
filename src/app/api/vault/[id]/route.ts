// GET /api/vault/<id> -> the document and its text (for the preview). PATCH {name} renames. DELETE removes the file, its text, passages and vectors. Only this browser's documents: anything else is "not found".
import { cleanName } from "@/lib/vault/files.mjs";
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { deleteDoc, getDoc, getText, patchDoc } from "@/lib/vault/store";

const NOT_FOUND = () => json({ error: "Document not found." }, 404);
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return NOT_FOUND();
  try {
    const d = await getDoc(bid, id); if (!d) return NOT_FOUND();
    const t = d.status === "unreadable" ? null : await getText(bid, id), { storageKey: _k, ...doc } = d;
    return json({ doc, text: t ? t.body.slice(0, 400_000) : null, truncated: !!t && t.body.length > 400_000, pageStarts: t?.pageStarts ?? null });
  } catch { return json({ error: "Could not load the document." }, 503); }
}
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return NOT_FOUND();
  const body = (await req.json().catch(() => null)) as { name?: unknown } | null, name = typeof body?.name === "string" ? cleanName(body.name) : "";
  if (name.length < 1) return json({ error: "Type a name." }, 422);
  try { return (await patchDoc(bid, id, { name })) ? json({ ok: true, name }) : NOT_FOUND(); } catch { return json({ error: "Could not rename." }, 503); }
}
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return NOT_FOUND();
  try { return (await deleteDoc(bid, id)) ? json({ ok: true }) : NOT_FOUND(); } catch { return json({ error: "Could not delete. Please try again." }, 503); }
}
