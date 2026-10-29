// GET /api/chat/source?actId=..&sectionKey=..  or  ?caseId=..&passage=..  -> the text of one cited source, for the "cited page" beside an answer. Read-only; the password gate covers it like the rest of /api/chat.
// The text comes from the data-access module (src/lib/legal-data): this route knows no table or file.
import { judgmentExcerpt, legalDataConfigured, sectionDetail } from "@/lib/legal-data";

const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "private, max-age=300" } });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, actId = q.get("actId")?.trim(), sectionKey = q.get("sectionKey")?.trim(), caseId = q.get("caseId")?.trim();
  try {
    if (caseId) { const x = await judgmentExcerpt(caseId, Number(q.get("passage") ?? 0)); return x ? json({ kind: "judgment", ...x }) : json({ error: "Excerpt not available." }, 404); }
    if (!actId || !sectionKey || actId.length > 200 || sectionKey.length > 200) return json({ error: "actId and sectionKey are required." }, 400);
    if (!legalDataConfigured()) return json({ error: "Section text is not available here." }, 503);
    const d = await sectionDetail(actId, sectionKey);
    return d ? json({ kind: "act", ...d }) : json({ error: "Section not found." }, 404);
  } catch { return json({ error: "Could not load the source." }, 503); }
}
