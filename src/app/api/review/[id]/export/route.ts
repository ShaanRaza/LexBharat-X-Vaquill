// GET /api/review/<id>/export?format=docx|pdf -> the saved review as a file (same builders and Noto fonts as the Drafting export).
import { buildDocx, buildPdf } from "@/lib/drafting/export.mjs";
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { reviewFileName, reviewToBlocks } from "@/lib/review/blocks.mjs";
import { getRun } from "@/lib/review/store";

export const maxDuration = 60;
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req), format = new URL(req.url).searchParams.get("format");
  if (!bid || !vaultReady()) return json({ error: "Review not found." }, 404);
  if (format !== "docx" && format !== "pdf") return json({ error: "format must be docx or pdf." }, 422);
  const run = await getRun(bid, id).catch(() => null); if (!run?.result) return json({ error: "Review not found." }, 404);
  try {
    const blocks = reviewToBlocks(run), meta = { title: `Contract review: ${run.docName}` };
    const body = format === "docx" ? await buildDocx(blocks, meta) : await buildPdf(blocks, meta);
    return new Response(new Uint8Array(body), { headers: { "Cache-Control": "no-store", "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", "Content-Disposition": `attachment; filename="${reviewFileName(run)}.${format}"` } });
  } catch { return json({ error: "The file could not be built." }, 500); }
}
