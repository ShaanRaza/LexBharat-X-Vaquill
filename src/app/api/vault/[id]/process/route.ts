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
  } catch (e) {
    // never answer "fine, keep waiting" for a real error: that hides the cause and loops for ever. The page shows this message and retries with a growing pause.
    console.error("[vault/process] step failed", id, e);
    return json({ state: "error", message: "A step failed on the server.", detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500);
  }
}
