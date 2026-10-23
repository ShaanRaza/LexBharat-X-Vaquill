// Saved drafts in the main Neon database (tables in scripts/drafting/drafting-schema.sql), keyed to the anonymous browser id. LOGIC ONLY. Every read and write checks the browser id.
import { query } from "@/lib/acts/db";
import type { Doc, SectionText } from "./docmodel.mjs";

export type BasisItem = { n: number; actId: string; sectionKey: string; actTitle: string; number: string | null; heading: string | null; status: string; category: string; state: string | null; relied: boolean; used?: boolean; why: string | null; preview?: string };
export type Warnings = { unverified: { text: string }[]; amounts: string[] };
export type DraftRow = {
  id: string; title: string; templateId: string; fields: Record<string, string>; extra: string | null; basis: BasisItem[]; checklist: { id: string; text: string }[];
  sections: SectionText[]; warnings: Warnings; doc: Doc; model: string | null; createdAt: string; updatedAt: string;
};
export type DraftSummary = { id: string; title: string; templateId: string; updatedAt: string };
export type VersionRow = { id: number; label: string; createdAt: string };

export const isDraftId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export const MAX_DOC_BYTES = 400_000, MAX_CHECKPOINTS = 4, CHECKPOINT_EVERY_MIN = 10;

export async function createDraft(bid: string, d: Omit<DraftRow, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const r = await query<{ id: string }>(
    "INSERT INTO drafts (browser_id, title, template_id, fields, extra, basis, checklist, sections, warnings, doc, model) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    [bid, d.title, d.templateId, JSON.stringify(d.fields), d.extra, JSON.stringify(d.basis), JSON.stringify(d.checklist), JSON.stringify(d.sections), JSON.stringify(d.warnings), JSON.stringify(d.doc), d.model]);
  await query("INSERT INTO draft_versions (draft_id, label, doc) VALUES ($1, 'generated', $2)", [r[0].id, JSON.stringify(d.doc)]);
  return r[0].id;
}
export async function getDraft(bid: string, id: string): Promise<DraftRow | null> {
  const r = await query<DraftRow>(`SELECT id, title, template_id AS "templateId", fields, extra, basis, checklist, sections, warnings, doc, model, created_at AS "createdAt", updated_at AS "updatedAt" FROM drafts WHERE id = $1 AND browser_id = $2`, [id, bid]);
  return r[0] ?? null;
}
export async function listDrafts(bid: string, limit = 50): Promise<DraftSummary[]> {
  return query<DraftSummary>(`SELECT id, title, template_id AS "templateId", updated_at AS "updatedAt" FROM drafts WHERE browser_id = $1 ORDER BY updated_at DESC LIMIT ${Math.floor(limit)}`, [bid]);
}
export async function countDrafts(bid: string): Promise<number> { return Number((await query<{ n: string }>("SELECT count(*) AS n FROM drafts WHERE browser_id = $1", [bid]))[0].n); }
export async function deleteDraft(bid: string, id: string): Promise<boolean> { return (await query("DELETE FROM drafts WHERE id = $1 AND browser_id = $2 RETURNING id", [id, bid])).length > 0; }
export async function renameDraft(bid: string, id: string, title: string): Promise<boolean> { return (await query("UPDATE drafts SET title = $3, updated_at = now() WHERE id = $1 AND browser_id = $2 RETURNING id", [id, bid, title.slice(0, 120)])).length > 0; }

/** Autosave: replaces the latest edit; every CHECKPOINT_EVERY_MIN minutes it also keeps a checkpoint (at most MAX_CHECKPOINTS, oldest dropped). Returns the saved time, or null if the draft is not this browser's. */
export async function saveEdit(bid: string, id: string, doc: Doc): Promise<string | null> {
  const r = await query<{ updatedAt: string }>(`UPDATE drafts SET doc = $3, updated_at = now() WHERE id = $1 AND browser_id = $2 RETURNING updated_at AS "updatedAt"`, [id, bid, JSON.stringify(doc)]);
  if (!r.length) return null;
  const last = await query<{ recent: boolean }>(`SELECT (created_at > now() - interval '${CHECKPOINT_EVERY_MIN} minutes') AS recent FROM draft_versions WHERE draft_id = $1 AND label = 'checkpoint' ORDER BY id DESC LIMIT 1`, [id]);
  if (!last.length || !last[0].recent) { await addVersion(id, "checkpoint", doc); }
  return r[0].updatedAt;
}
export async function addVersion(id: string, label: "checkpoint" | "saved" | "before-restore", doc: Doc) {
  await query("INSERT INTO draft_versions (draft_id, label, doc) VALUES ($1,$2,$3)", [id, label, JSON.stringify(doc)]);
  await query(`DELETE FROM draft_versions WHERE draft_id = $1 AND label <> 'generated' AND id NOT IN (SELECT id FROM draft_versions WHERE draft_id = $1 AND label <> 'generated' ORDER BY id DESC LIMIT ${MAX_CHECKPOINTS})`, [id]);
}
export async function listVersions(id: string): Promise<VersionRow[]> { return query<VersionRow>(`SELECT id::int, label, created_at AS "createdAt" FROM draft_versions WHERE draft_id = $1 ORDER BY id DESC`, [id]); }
export async function getVersionDoc(id: string, versionId: number): Promise<Doc | null> { return (await query<{ doc: Doc }>("SELECT doc FROM draft_versions WHERE draft_id = $1 AND id = $2", [id, versionId]))[0]?.doc ?? null; }
export async function setSections(id: string, sections: SectionText[]) { await query("UPDATE drafts SET sections = $2 WHERE id = $1", [id, JSON.stringify(sections)]); }

// ---- usage counters for the limits (India time)
const TODAY = "(now() AT TIME ZONE 'Asia/Kolkata')::date";
export async function draftUsage(bid: string): Promise<{ day: number; week: number; month: number }> {
  const r = await query<{ day: string; week: string; month: string }>(
    `SELECT coalesce(sum(count) FILTER (WHERE browser_id = $1 AND day = ${TODAY}), 0) AS day, coalesce(sum(count) FILTER (WHERE browser_id = $1 AND day > ${TODAY} - 7), 0) AS week,
            coalesce(sum(count) FILTER (WHERE day >= date_trunc('month', ${TODAY})::date), 0) AS month FROM draft_usage WHERE day > ${TODAY} - 40`, [bid]);
  return { day: Number(r[0].day), week: Number(r[0].week), month: Number(r[0].month) };
}
export async function countDraft(bid: string) { await query(`INSERT INTO draft_usage (browser_id, day, count) VALUES ($1, ${TODAY}, 1) ON CONFLICT (browser_id, day) DO UPDATE SET count = draft_usage.count + 1`, [bid]); }
export async function uncountDraft(bid: string) { await query(`UPDATE draft_usage SET count = greatest(count - 1, 0) WHERE browser_id = $1 AND day = ${TODAY}`, [bid]); }
