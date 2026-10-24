// GET /api/review/<id> -> the saved review. DELETE removes it. Only this browser's reviews: anything else is "not found".
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { deleteRun, getRun } from "@/lib/review/store";

type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Review not found." }, 404);
  try { const r = await getRun(bid, id); return r ? json({ run: r }) : json({ error: "Review not found." }, 404); } catch { return json({ error: "Could not load the review." }, 503); }
}
export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Review not found." }, 404);
  try { return (await deleteRun(bid, id)) ? json({ ok: true }) : json({ error: "Review not found." }, 404); } catch { return json({ error: "Could not delete." }, 503); }
}
