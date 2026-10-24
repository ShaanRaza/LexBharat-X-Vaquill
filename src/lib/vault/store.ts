// Vault records in the Supabase Postgres (tables in scripts/vault/vault-schema.sql). LOGIC ONLY. Every read and write names the browser id, so one browser cannot see or change another's documents.
import { sb } from "./supabase";
import { getFileStore } from "./storage";

export type VaultStatus = "processing" | "ready" | "unreadable";
export type VaultDoc = { id: string; name: string; kind: "pdf" | "docx" | "txt"; sizeBytes: number; pages: number | null; status: VaultStatus; statusDetail: string | null; chunkCount: number; embeddedCount: number; createdAt: string; updatedAt: string };
export type Passage = { id: string; docId: string; idx: number; page: number | null; label: string | null; body: string };

import { isUuid } from "./ids";
export { isUuid };
type Row = Record<string, unknown>;
const doc = (r: Row): VaultDoc => ({ id: r.id as string, name: r.name as string, kind: r.kind as VaultDoc["kind"], sizeBytes: Number(r.size_bytes), pages: (r.pages as number | null) ?? null, status: r.status as VaultStatus,
  statusDetail: (r.status_detail as string | null) ?? null, chunkCount: Number(r.chunk_count), embeddedCount: Number(r.embedded_count), createdAt: r.created_at as string, updatedAt: r.updated_at as string });
const COLS = "id,name,kind,size_bytes,pages,status,status_detail,chunk_count,embedded_count,created_at,updated_at";
const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export async function listDocs(bid: string): Promise<VaultDoc[]> { return must(await sb().from("vault_documents").select(COLS).eq("browser_id", bid).order("created_at", { ascending: false })).map(doc); }
export async function getDoc(bid: string, id: string): Promise<(VaultDoc & { storageKey: string }) | null> {
  if (!isUuid(id)) return null;
  const r = must(await sb().from("vault_documents").select(`${COLS},storage_key`).eq("id", id).eq("browser_id", bid).maybeSingle());
  return r ? { ...doc(r as Row), storageKey: (r as Row).storage_key as string } : null;
}
/** The documents among `ids` that belong to this browser. */
export async function getDocs(bid: string, ids: string[]): Promise<VaultDoc[]> {
  const ok = ids.filter(isUuid); if (!ok.length) return [];
  return must(await sb().from("vault_documents").select(COLS).eq("browser_id", bid).in("id", ok)).map(doc);
}
export async function createDoc(bid: string, d: { id: string; name: string; kind: string; sizeBytes: number; storageKey: string }) {
  must(await sb().from("vault_documents").insert({ id: d.id, browser_id: bid, name: d.name, kind: d.kind, size_bytes: d.sizeBytes, storage_key: d.storageKey }));
}
export async function patchDoc(bid: string, id: string, p: Partial<{ name: string; pages: number | null; status: VaultStatus; status_detail: string | null; chunk_count: number; embedded_count: number; size_bytes: number }>) {
  const r = must(await sb().from("vault_documents").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id).eq("browser_id", bid).select("id"));
  return r.length > 0;
}
/** Deletes the file in storage, then the record; its text, passages and vectors go with it (cascade). Returns false if the document is not this browser's. */
export async function deleteDoc(bid: string, id: string): Promise<boolean> {
  const d = await getDoc(bid, id); if (!d) return false;
  await getFileStore().remove([d.storageKey]);
  must(await sb().from("vault_documents").delete().eq("id", id).eq("browser_id", bid));
  return true;
}
export async function saveText(bid: string, id: string, body: string, pageStarts: number[] | null) {
  must(await sb().from("vault_texts").upsert({ doc_id: id, browser_id: bid, body, page_starts: pageStarts }));
}
export async function getText(bid: string, id: string): Promise<{ body: string; pageStarts: number[] | null } | null> {
  const r = must(await sb().from("vault_texts").select("body,page_starts").eq("doc_id", id).eq("browser_id", bid).maybeSingle()) as Row | null;
  return r ? { body: r.body as string, pageStarts: (r.page_starts as number[] | null) ?? null } : null;
}
export async function replaceChunks(bid: string, id: string, chunks: { idx: number; page: number | null; label: string | null; body: string }[]) {
  must(await sb().from("vault_chunks").delete().eq("doc_id", id).eq("browser_id", bid));
  for (let i = 0; i < chunks.length; i += 200) must(await sb().from("vault_chunks").insert(chunks.slice(i, i + 200).map((c) => ({ doc_id: id, browser_id: bid, ...c }))));
}
/** The next chunks with no vector yet, in reading order. */
export async function pendingChunks(bid: string, id: string, limit: number): Promise<{ id: string; idx: number; page: number | null; label: string | null; body: string }[]> {
  return must(await sb().from("vault_chunks").select("id,idx,page,label,body").eq("doc_id", id).eq("browser_id", bid).is("embedding", null).order("idx").limit(limit));
}
export async function setVectors(bid: string, id: string, rows: { id: string; idx: number; page: number | null; label: string | null; body: string; embedding: number[] }[]) {
  must(await sb().from("vault_chunks").upsert(rows.map((r) => ({ ...r, doc_id: id, browser_id: bid, embedding: r.embedding })), { onConflict: "id" }));
}
export async function countEmbedded(bid: string, id: string): Promise<number> {
  const r = await sb().from("vault_chunks").select("id", { count: "exact", head: true }).eq("doc_id", id).eq("browser_id", bid).not("embedding", "is", null);
  if (r.error) throw new Error(r.error.message); return r.count ?? 0;
}
export async function chunksOf(bid: string, ids: string[], limit = 3000): Promise<Passage[]> {
  const rows = must(await sb().from("vault_chunks").select("id,doc_id,idx,page,label,body").eq("browser_id", bid).in("doc_id", ids).order("idx").limit(limit)) as Row[];
  return rows.map((r) => ({ id: r.id as string, docId: r.doc_id as string, idx: r.idx as number, page: (r.page as number | null) ?? null, label: (r.label as string | null) ?? null, body: r.body as string }));
}
export async function matchChunks(bid: string, docIds: string[] | null, vector: number[], k: number): Promise<(Passage & { similarity: number })[]> {
  const r = must(await sb().rpc("match_vault_chunks", { query_embedding: vector, p_browser: bid, p_doc_ids: docIds, p_k: k })) as Row[];
  return r.map((x) => ({ id: x.id as string, docId: x.doc_id as string, idx: x.idx as number, page: (x.page as number | null) ?? null, label: (x.label as string | null) ?? null, body: x.body as string, similarity: Number(x.similarity) }));
}

// ---- usage log for the review limits (India time)
const istStart = (d = new Date()) => { const ms = d.getTime() + 5.5 * 3600e3, day = Math.floor(ms / 86400e3) * 86400e3; return new Date(day - 5.5 * 3600e3); };
const istMonthStart = () => { const n = new Date(Date.now() + 5.5 * 3600e3); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1) - 5.5 * 3600e3); };
export async function usageCounts(bid: string, kind: string): Promise<{ day: number; week: number; month: number }> {
  const c = async (since: Date, own: boolean) => { let q = sb().from("vault_usage").select("id", { count: "exact", head: true }).eq("kind", kind).gte("at", since.toISOString()); if (own) q = q.eq("browser_id", bid); const r = await q; if (r.error) throw new Error(r.error.message); return r.count ?? 0; };
  const [day, week, month] = await Promise.all([c(istStart(), true), c(new Date(Date.now() - 7 * 86400e3), true), c(istMonthStart(), false)]);
  return { day, week, month };
}
export async function addUsage(bid: string, kind: string): Promise<number> { const r = must(await sb().from("vault_usage").insert({ browser_id: bid, kind }).select("id")) as Row[]; return Number(r[0].id); }
export async function removeUsage(id: number) { await sb().from("vault_usage").delete().eq("id", id); }
