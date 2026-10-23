// Where an Act page gets its section text: Neon when DATABASE_URL is set (works in production without any file storage), otherwise the local files in
// ACTS_TEXT_DATA_DIR, otherwise the honest "not available yet" state. Never throws. LOGIC ONLY.
import { query, dbConfigured } from "./db";
import { getActText } from "./sectionText";
import { toSectionRecord } from "./sectionRecord.mjs";
import { confidentMissing } from "./missing.mjs";
import { buildActTextView, type ActTextView, type ListedSection } from "./viewModel";
import { officialSourceUrl } from "./quality";

export type ActTextOutcome =
  | { available: true; origin: "database" | "files"; view: ActTextView; officialUrl: string }
  | { available: false; reason: "not_configured" | "not_in_export" | "unreadable"; message: string };

type Row = Omit<ListedSection, "body"> & { chunkCount: number };

async function fromDatabase(actId: string, wanted: string | undefined): Promise<ActTextOutcome | "missing"> {
  const [acts, secs, miss] = await Promise.all([
    query<{ sourceUrl: string | null }>(`SELECT source_url AS "sourceUrl" FROM acts WHERE act_id = $1`, [actId]),
    query<Row & { sectionKey: string }>(`SELECT section_key AS "sectionKey", ord, number, heading, chapter, status, flags, chunk_count AS "chunkCount" FROM act_sections WHERE act_id = $1 ORDER BY ord`, [actId]),
    query<{ number: number }>(`SELECT number FROM act_missing_sections WHERE act_id = $1 ORDER BY number`, [actId]).catch(() => []), // table absent in an older load: no placeholders
  ]);
  if (!acts.length || !secs.length) return "missing";
  const missing = miss.map((m) => Number(m.number));
  const first = buildActTextView(secs, acts[0].sourceUrl, wanted, missing); // decides which row is shown; its text is fetched next
  const sel = first.selected;
  if (!sel || sel.missing) return { available: true, origin: "database", view: first, officialUrl: officialSourceUrl(acts[0].sourceUrl) };
  const body = await query<{ body: string | null }>(`SELECT body FROM act_sections WHERE act_id = $1 AND section_key = $2`, [actId, sel.key]);
  const listed: ListedSection[] = secs.map((s) => (s.sectionKey === sel.key ? { ...s, body: body[0]?.body ?? null } : s));
  return { available: true, origin: "database", view: buildActTextView(listed, acts[0].sourceUrl, sel.key, missing), officialUrl: officialSourceUrl(acts[0].sourceUrl) };
}

export async function loadActText(actId: string, wanted: string | undefined): Promise<ActTextOutcome> {
  if (dbConfigured()) {
    try {
      const r = await fromDatabase(actId, wanted);
      if (r !== "missing") return r;
    } catch { /* database unreachable: fall through to local files if they are configured */ }
  }
  const t = await getActText(actId);
  if (t.available) {
    const recs = t.doc.sections.map((s, i) => toSectionRecord(s, i));
    return { available: true, origin: "files", view: buildActTextView(recs, t.doc.sourceUrl, wanted, confidentMissing(recs, t.doc.title).numbers), officialUrl: officialSourceUrl(t.doc.sourceUrl) };
  }
  if (dbConfigured() && t.reason === "not_configured") return { available: false, reason: "not_in_export", message: "Section text for this entry is not included yet (regulator instruments are excluded, or the Act is not in the loaded data)." };
  return t;
}
