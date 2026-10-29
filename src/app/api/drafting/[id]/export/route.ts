// GET /api/drafting/<id>/export?format=docx|pdf -> the latest edit of the draft as a file. Word and Google Docs open the .docx; the PDF uses standard fonts (the rupee sign is written "Rs.").
import { dbConfigured } from "@/lib/app-db";
import { docToBlocks } from "@/lib/drafting/docmodel.mjs";
import { buildDocx, buildPdf } from "@/lib/drafting/export.mjs";
import { bidOf, json } from "@/lib/drafting/http";
import { getDraft, isDraftId } from "@/lib/drafting/store";

export const maxDuration = 60;
const fileName = (t: string) => t.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "draft";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req), format = new URL(req.url).searchParams.get("format");
  if (!bid || !isDraftId(id) || !dbConfigured()) return json({ error: "Draft not found." }, 404);
  if (format !== "docx" && format !== "pdf") return json({ error: "format must be docx or pdf." }, 422);
  const d = await getDraft(bid, id).catch(() => null); if (!d) return json({ error: "Draft not found." }, 404);
  const blocks = docToBlocks(d.doc), name = fileName(d.title);
  try {
    const body = format === "docx" ? await buildDocx(blocks, { title: d.title }) : await buildPdf(blocks, { title: d.title });
    return new Response(new Uint8Array(body), { headers: { "Cache-Control": "no-store", "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", "Content-Disposition": `attachment; filename="${name}.${format}"` } });
  } catch { return json({ error: "The file could not be built." }, 500); }
}
