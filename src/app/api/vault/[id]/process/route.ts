// POST /api/vault/<id>/process -> does ONE step of reading a document (read the text, or embed the next batch of passages) and says what to do next. The page repeats it until the document is Ready or Can't read.
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { processStep } from "@/lib/vault/process";

export const maxDuration = 60;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Document not found." }, 404);
  try {
    const r = await processStep(bid, id);
    if (r.state === "gone" && !r.message) return json({ error: "Document not found." }, 404);
    return json(r.doc ? { ...r, doc: { ...r.doc } } : r);
  } catch { return json({ state: "embedding", waitMs: 15000, message: "Processing… (will retry)" }); }
}
