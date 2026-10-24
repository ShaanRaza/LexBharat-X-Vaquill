// POST /api/review/<id>/step {retry?: part number | "summary" | "law"} -> does the next unit of the review (a part of the contract, the summary, or the law points) and returns the saved review.
// If every part ends up failed, the review is not counted against the limits.
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { removeUsage } from "@/lib/vault/store";
import { stepReview } from "@/lib/review/run";

export const maxDuration = 60;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Review not found." }, 404);
  const b = (await req.json().catch(() => null)) as { retry?: unknown } | null;
  const retry = typeof b?.retry === "number" ? Math.floor(b.retry) : b?.retry === "summary" || b?.retry === "law" ? b.retry : undefined;
  try {
    const r = await stepReview(bid, id, retry); if (!r.run) return json({ error: "Review not found." }, 404);
    if (r.run.status === "failed" && r.run.result?.usageId) { await removeUsage(r.run.result.usageId).catch(() => null); }
    return json({ run: r.run, busy: !!r.busy });
  } catch { return json({ error: "That step failed. It will be retried." }, 503); }
}
