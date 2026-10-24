// Turns an uploaded file into searchable passages, one resumable step at a time. LOGIC ONLY. The page calls /api/vault/<id>/process again and again until the document is Ready (or Can't read):
// step 1 reads the file's text and cuts it into passages; each later step embeds the next batch of passages (the free Voyage account allows 3 requests a minute, so a long file takes a while).
// Everything is stored as it goes, so an interrupted run (closed tab, restart) simply continues from the passages that still have no vector.
import limitConfig from "@/config/vault-limits.json";
import { chunkPages, pageAt } from "./chunk.mjs";
import { extractText } from "./extract.mjs";
import { MB, readVaultLimits, sniffKind } from "./files.mjs";
import { EmbedWait, embedDocuments } from "./embedDocs";
import { getFileStore } from "./storage";
import { countEmbedded, deleteDoc, getDoc, patchDoc, pendingChunks, replaceChunks, saveText, setVectors, type VaultDoc } from "./store";

export type StepResult = { state: "extracted" | "embedding" | "ready" | "unreadable" | "waiting" | "gone" | "busy"; doc?: VaultDoc; waitMs?: number; message?: string };
const limits = () => readVaultLimits(limitConfig, process.env as Record<string, string | undefined>);
const g = globalThis as unknown as { __vaultLocks?: Set<string> };
const locks = (g.__vaultLocks ??= new Set<string>());
const NO_TYPE = (k: string) => `This doesn't look like a real ${k === "pdf" ? "PDF" : k === "docx" ? "Word" : "text"} file, so it can't be read.`;

async function fail(bid: string, id: string, detail: string): Promise<StepResult> {
  await patchDoc(bid, id, { status: "unreadable", status_detail: detail });
  return { state: "unreadable", doc: (await getDoc(bid, id)) ?? undefined, message: detail };
}

export async function processStep(bid: string, id: string): Promise<StepResult> {
  const lim = limits(), d0 = await getDoc(bid, id);
  if (!d0) return { state: "gone" };
  if (d0.status === "ready") return { state: "ready", doc: d0 };
  if (d0.status === "unreadable") return { state: "unreadable", doc: d0, message: d0.statusDetail ?? "" };
  if (locks.has(id)) return { state: "busy", waitMs: 2000, doc: d0 };
  locks.add(id);
  try {
    // ---- step 1: read the text
    if (d0.chunkCount === 0) {
      const store = getFileStore(), size = await store.size(d0.storageKey);
      if (size === null) {
        if (Date.now() - new Date(d0.createdAt).getTime() > lim.uploadWaitMinutes * 60000) { await deleteDoc(bid, id).catch(() => null); return { state: "gone", message: "The upload did not finish, so the entry was removed." }; }
        return { state: "waiting", waitMs: 3000, doc: d0, message: "Waiting for the upload to finish." };
      }
      if (size > lim.maxFileMb * MB) { await store.remove([d0.storageKey]).catch(() => null); return fail(bid, id, `This file is larger than ${lim.maxFileMb} MB.`); }
      const bytes = await store.get(d0.storageKey);
      if (!bytes) return { state: "waiting", waitMs: 3000, doc: d0 };
      if (sniffKind(bytes) !== d0.kind) return fail(bid, id, NO_TYPE(d0.kind));
      const ex = await extractText(d0.kind, bytes, { scannedMinCharsPerPage: lim.scannedMinCharsPerPage });
      if (!ex.pages) return fail(bid, id, ex.reason || "This file can't be read.");
      const chunks = chunkPages(ex.pages, { chars: lim.chunkChars, overlap: lim.chunkOverlap }).map((c) => (ex.noPages ? { ...c, page: null } : c));   // Word and text files have no page numbers; never show "page 1" for them
      if (!chunks.length) return fail(bid, id, "No text was found in this file.");
      if (chunks.length > lim.maxChunks) return fail(bid, id, `This file is too long to index on the free plan (${chunks.length} passages; the most is ${lim.maxChunks}). Try a shorter document.`);
      const starts: number[] = []; let off = 0;
      for (const p of ex.pages) { starts.push(off); off += p.length + 2; }
      await saveText(bid, id, ex.text, ex.noPages ? null : starts);
      await replaceChunks(bid, id, chunks);
      await patchDoc(bid, id, { pages: ex.pageCount, chunk_count: chunks.length, embedded_count: 0, size_bytes: size });
      return { state: "extracted", doc: (await getDoc(bid, id)) ?? undefined, waitMs: 0 };
    }
    // ---- later steps: embed the next batch
    const pend = await pendingChunks(bid, id, lim.embedBatch);
    if (!pend.length) { await patchDoc(bid, id, { status: "ready", status_detail: null, embedded_count: d0.chunkCount }); return { state: "ready", doc: (await getDoc(bid, id)) ?? undefined }; }
    const batch: typeof pend = []; let chars = 0;
    for (const c of pend) { if (batch.length && chars + c.body.length > lim.embedMaxChars) break; batch.push(c); chars += c.body.length; }
    try {
      const vecs = await embedDocuments(batch.map((c) => (c.label ? `${c.label}\n${c.body}` : c.body)), lim.embedMinGapMs);
      await setVectors(bid, id, batch.map((c, i) => ({ ...c, embedding: vecs[i] })));
    } catch (e) {
      if (e instanceof EmbedWait) return { state: "embedding", waitMs: e.waitMs, doc: (await getDoc(bid, id)) ?? undefined, message: e.reason === "gap" ? "Processing… (waiting for the free-plan rate limit)" : "Processing… (the embedding service is busy, will retry)" };
      throw e;
    }
    const done = await countEmbedded(bid, id), ready = done >= d0.chunkCount;
    await patchDoc(bid, id, { embedded_count: done, ...(ready ? { status: "ready" as const, status_detail: null } : {}) });
    return { state: ready ? "ready" : "embedding", doc: (await getDoc(bid, id)) ?? undefined, waitMs: ready ? 0 : lim.embedMinGapMs };
  } finally { locks.delete(id); }
}
