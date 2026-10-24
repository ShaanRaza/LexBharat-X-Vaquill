// Where an Act page gets its section text: Neon when DATABASE_URL is set (works in production without any file storage), otherwise the local files in
// ACTS_TEXT_DATA_DIR, otherwise the honest "not available yet" state. Never throws. LOGIC ONLY.
import { query, dbConfigured } from "./db";
import { getActText } from "./sectionText";
import { toSectionRecord } from "./sectionRecord.mjs";
import { confidentMissing } from "./missing.mjs";
import { buildActTextView, type ActTextView, type ListedSection, type ScheduleGaps } from "./viewModel";
import { officialSourceUrl } from "./quality";
import { buildScheduleTable } from "./scheduleTable.mjs";
import gapConfig from "@/config/schedule-gaps.json";

const gapsOf = (actId: string): ScheduleGaps => (gapConfig as Record<string, ScheduleGaps | string>)[actId] as ScheduleGaps;

export type ActTextOutcome =
  | { available: true; origin: "database" | "files"; view: ActTextView; officialUrl: string }
  | { available: false; reason: "not_configured" | "not_in_export" | "unreadable"; message: string };

type Row = Omit<ListedSection, "body"> & { chunkCount: number };

async function fromDatabase(actId: string, wanted: string | undefined): Promise<ActTextOutcome | "missing"> {
  const [acts, secs, miss] = await Promise.all([
    query<{ sourceUrl: string | null }>(`SELECT source_url AS "sourceUrl" FROM acts WHERE act_id = $1`, [actId]),
    query<Row & { sectionKey: string }>(`SELECT section_key AS "sectionKey", ord, number, heading, chapter, status, flags, chunk_count AS "chunkCount" FROM act_sections_v WHERE act_id = $1 ORDER BY ord, (flags @> ARRAY['supplement']), length(number), number`, [actId]),
    query<{ number: number }>(`SELECT m.number FROM act_missing_sections m WHERE m.act_id = $1 AND NOT EXISTS (SELECT 1 FROM act_sections_supplement x WHERE x.act_id = m.act_id AND x.number = m.number::text) ORDER BY m.number`, [actId]).catch(() => []), // table absent in an older load: no placeholders
  ]);
  if (!acts.length || !secs.length) return "missing";
  if (wanted === "schedule") {   // the Schedule Articles as one table (Limitation Act, Stamp Act)
    const units = await query<{ number: string; body: string }>(`SELECT number, body FROM act_sections_supplement WHERE act_id = $1 AND number ~ '^A[0-9]'`, [actId]);
    const table = buildScheduleTable(units, gapsOf(actId));
    if (table.rows.length) return { available: true, origin: "database", view: { ...buildActTextView(secs, acts[0].sourceUrl, undefined, [], gapsOf(actId)), schedule: table }, officialUrl: officialSourceUrl(acts[0].sourceUrl) };
  }
  const missing = miss.map((m) => Number(m.number));
  const first = buildActTextView(secs, acts[0].sourceUrl, wanted, missing, gapsOf(actId)); // decides which row is shown; its text is fetched next
  const sel = first.selected;
  if (!sel || sel.missing) return { available: true, origin: "database", view: first, officialUrl: officialSourceUrl(acts[0].sourceUrl) };
  const body = await query<{ body: string | null }>(`SELECT body FROM act_sections_v WHERE act_id = $1 AND section_key = $2`, [actId, sel.key]);
  // a hand-filled section carries where it was copied from, for the "Source: India Code, copied <date>" line
  const supp = secs.find((s) => s.sectionKey === sel.key)?.flags.includes("supplement")
    ? (await query<{ source: string; sourceUrl: string; copiedOn: string }>(`SELECT source, source_url AS "sourceUrl", copied_on::text AS "copiedOn" FROM act_sections_supplement WHERE act_id = $1 AND section_key = $2`, [actId, sel.key]).catch(() => []))[0]
    : undefined;
  const listed: ListedSection[] = secs.map((s) => (s.sectionKey === sel.key ? { ...s, body: body[0]?.body ?? null, ...(supp ? { supplement: supp } : {}) } : s));
  return { available: true, origin: "database", view: buildActTextView(listed, acts[0].sourceUrl, sel.key, missing, gapsOf(actId)), officialUrl: officialSourceUrl(acts[0].sourceUrl) };
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
