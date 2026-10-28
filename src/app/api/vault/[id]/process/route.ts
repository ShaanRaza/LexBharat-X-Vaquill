// POST /api/vault/<id>/process -> does ONE step of reading a document (read the text, or embed the next batch of passages) and says what to do next. The page repeats it until the document is Ready or Can't read.
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { processStep } from "@/lib/vault/process";
import { getDoc, patchDoc } from "@/lib/vault/store";

export const maxDuration = 60;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req); if (!bid || !vaultReady()) return json({ error: "Document not found." }, 404);
  try {
    const r = await processStep(bid, id);
    if (r.state === "gone" && !r.message) return json({ error: "Document not found." }, 404);
    return json(r.doc ? { ...r, doc: { ...r.doc } } : r);
  } catch (e) {
    // A step threw. Say so in the server log (never the document text or a key), count the failures on the document, and give up with a plain reason after 5 in a row instead of retrying for ever.
    console.error("vault step failed", id, e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : "unknown");
    try {
      const d = await getDoc(bid, id), n = Number(/^attempt (\d+)/.exec(d?.statusDetail ?? "")?.[1] ?? 0) + 1;
      if (d && n >= 5) { await patchDoc(bid, id, { status: "unreadable", status_detail: "This file could not be processed (the same error happened 5 times). Try uploading it again." }); return json({ state: "unreadable", message: "This file could not be processed." }); }
      if (d) await patchDoc(bid, id, { status_detail: `attempt ${n}` });
    } catch { /* the store itself is unreachable: just ask the page to retry */ }
    return json({ state: "embedding", waitMs: 8000, message: "Processing… (a step failed and will be retried)" });
  }
}
