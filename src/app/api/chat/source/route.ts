// GET /api/chat/source?actId=..&sectionKey=..  or  ?caseId=..&passage=..  -> the text of one cited source, for the "cited page" beside an answer. Read-only; the password gate covers it like the rest of /api/chat.
import { query, dbConfigured } from "@/lib/acts/db";
import { getCaseText } from "@/lib/judgments/scText";

const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "private, max-age=300" } });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, actId = q.get("actId")?.trim(), sectionKey = q.get("sectionKey")?.trim(), caseId = q.get("caseId")?.trim();
  try {
    if (caseId) {
      const passage = Number(q.get("passage") ?? 0), text = await getCaseText(caseId);
      const chunk = text?.chunks.find((c) => c.i === passage) ?? text?.chunks[passage];
      return chunk ? json({ kind: "judgment", text: chunk.t, page: chunk.ps }) : json({ error: "Excerpt not available." }, 404);
    }
    if (!actId || !sectionKey || actId.length > 200 || sectionKey.length > 200) return json({ error: "actId and sectionKey are required." }, 400);
    if (!dbConfigured()) return json({ error: "Section text is not available here." }, 503);
    const rows = await query<{ title: string; number: string | null; heading: string | null; status: string; body: string | null }>(
      `SELECT a.title, s.number, s.heading, s.status, left(s.body, 20000) AS body FROM act_sections_v s JOIN acts a ON a.act_id = s.act_id WHERE s.act_id = $1 AND s.section_key = $2`, [actId, sectionKey]);
    return rows.length ? json({ kind: "act", ...rows[0] }) : json({ error: "Section not found." }, 404);
  } catch { return json({ error: "Could not load the source." }, 503); }
}
