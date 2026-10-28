// Turns an uploaded file into searchable passages, one resumable step at a time. LOGIC ONLY. The page calls /api/vault/<id>/process again and again until the document is Ready (or Can't read):
// step 1 reads the file's text and cuts it into passages; each later step embeds the next batch of passages (the free Voyage account allows 3 requests a minute, so a long file takes a while).
// Everything is stored as it goes, so an interrupted run (closed tab, restart) simply continues from the passages that still have no vector.
import limitConfig from "@/config/vault-limits.json";
import { chunkPages, pageAt } from "./chunk.mjs";
import { extractText, readPdfPages } from "./extract.mjs";
import type { Extracted } from "./extract.mjs";
import { takeLease } from "./lease";
import { MB, readVaultLimits, sniffKind } from "./files.mjs";
import { EmbedWait, embedDocuments } from "./embedDocs";
import { getFileStore } from "./storage";
import { readScanPages } from "./ocr";
import { mergePages, planScan } from "./scan.mjs";
import { bump } from "@/lib/insights/server";
import { addUsage, countEmbedded, deleteDoc, getDoc, getScanPages, getText, patchDoc, pendingChunks, replaceChunks, saveScanPage, saveText, setVectors, usageCounts, type VaultDoc } from "./store";

export type StepResult = { state: "extracted" | "reading" | "embedding" | "ready" | "unreadable" | "waiting" | "gone" | "busy"; doc?: VaultDoc; waitMs?: number; message?: string };
const limits = () => readVaultLimits(limitConfig, process.env as Record<string, string | undefined>);
const g = globalThis as unknown as { __vaultLocks?: Map<string, number> };
const locks = (g.__vaultLocks ??= new Map<string, number>());
const NO_TYPE = (k: string) => `This doesn't look like a real ${k === "pdf" ? "PDF" : k === "docx" ? "Word" : k === "txt" ? "text" : "picture"} file, so it can't be read.`;

/** Where each page starts in the stored text (pages are joined by a blank line), and the pages back out of the stored text. */
const startsOf = (pages: string[]) => { const out: number[] = []; let off = 0; for (const p of pages) { out.push(off); off += p.length + 2; } return out; };
const pagesOf = (body: string, starts: number[] | null) => (starts ?? []).map((a, i) => body.slice(a, i + 1 < starts!.length ? starts![i + 1] - 2 : body.length));

async function fail(bid: string, id: string, detail: string): Promise<StepResult> {
  await patchDoc(bid, id, { status: "unreadable", status_detail: detail });
  return { state: "unreadable", doc: (await getDoc(bid, id)) ?? undefined, message: detail };
}

export async function processStep(bid: string, id: string): Promise<StepResult> {
  const lim = limits(), d0 = await getDoc(bid, id);
  if (!d0) return { state: "gone" };
  if (d0.status === "ready") return { state: "ready", doc: d0 };
  if (d0.status === "unreadable") return { state: "unreadable", doc: d0, message: d0.statusDetail ?? "" };
  if (!takeLease(locks, id)) return { state: "busy", waitMs: 2000, doc: d0 };
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
      let ex: Extracted;
      if (d0.kind === "pdf") {
        // a PDF is read a few pages per step; every step saves the pages so far, so a cut-off step costs only its own pages
        const tx = await getText(bid, id), have = tx?.pageStarts?.length ?? 0;
        if (!(d0.pages && have >= d0.pages)) {
          const r = await readPdfPages(bytes, have + 1, { maxPages: lim.readPages, budgetMs: lim.readBudgetMs });
          if (!r.total) return fail(bid, id, r.reason || "This file can't be read.");
          if (r.pages.length) {
            const prev = tx ? pagesOf(tx.body, tx.pageStarts) : [], all = [...prev, ...r.pages.map((p) => (p.replace(/\s+/g, "").length < lim.scannedMinCharsPerPage ? "" : p))];
            await saveText(bid, id, all.join("\n\n"), startsOf(all));
            await patchDoc(bid, id, { pages: r.total, status_detail: `Reading page ${all.length} of ${r.total}` });
            if (all.length < r.total) return { state: "reading", waitMs: 0, doc: (await getDoc(bid, id)) ?? undefined };
          }
        }
        const done = await getText(bid, id), pages = done ? pagesOf(done.body, done.pageStarts) : [];
        if (!pages.length) return fail(bid, id, "This file can't be read.");
        ex = { pages, text: pages.join("\n\n"), pageCount: pages.length, scanned: false, scanPages: pages.flatMap((p, i) => (p === "" ? [i + 1] : [])), reason: "" };
      } else ex = await extractText(d0.kind, bytes, { scannedMinCharsPerPage: lim.scannedMinCharsPerPage });
      if (!ex.pages) return fail(bid, id, ex.reason || "This file can't be read.");
      // ---- image-only pages (scans, photos): read by the "ocr" model, a few pages per step, each page saved as it is read
      if (ex.scanPages.length) {
        const plan = planScan(ex.scanPages, lim.maxScanPagesPerDoc);
        if (!d0.scanned) {   // first time this document needs reading: it counts once against the browser's daily number of scanned documents
          const used = await usageCounts(bid, "scan");
          if (used.day >= lim.maxScanDocsPerDay) { bump("limit_hit", "scan_day"); return fail(bid, id, `This document has scanned pages, and you have already read ${lim.maxScanDocsPerDay} scanned documents today (the daily limit). Try again tomorrow.`); }
          await addUsage(bid, "scan");
          await patchDoc(bid, id, { scanned: true, scan_total: plan.take.length, scan_skipped: plan.skipped, pages: ex.pageCount });
        }
        const done = await getScanPages(bid, id), left = plan.take.filter((p) => !done.has(p));
        if (left.length) {
          const group = left.slice(0, lim.scanGroupPages);
          await patchDoc(bid, id, { status: "processing", status_detail: `Reading scanned pages… (${done.size} of ${plan.take.length} done)` });
          const r = await readScanPages(d0.kind, bytes, group);
          if (!r.ok) {
            if (r.busy) { bump("model_busy", "ocr"); await patchDoc(bid, id, { status: "waiting", status_detail: `Waiting to read: the reading model is busy. ${done.size} of ${plan.take.length} scanned pages are done; the rest will be read shortly.` }); return { state: "waiting", waitMs: lim.scanRetryMs, doc: (await getDoc(bid, id)) ?? undefined, message: "Waiting to read" }; }
            return fail(bid, id, r.message);
          }
          for (const [p, body] of r.pages) await saveScanPage(bid, id, p, body);
          const n = done.size + group.length;
          await patchDoc(bid, id, { scan_pages: n, status_detail: `Reading scanned pages… (${n} of ${plan.take.length} done)` });
          return { state: "reading", waitMs: 0, doc: (await getDoc(bid, id)) ?? undefined };
        }
        ex.pages = mergePages(ex.pages, done);   // all pages read: carry on with the finished text
        ex.text = ex.pages.join("\n\n");
        bump("scan");
      }
      const chunks = chunkPages(ex.pages, { chars: lim.chunkChars, overlap: lim.chunkOverlap }).map((c) => (ex.noPages ? { ...c, page: null } : c));   // Word and text files have no page numbers; never show "page 1" for them
      if (!chunks.length) return fail(bid, id, ex.scanPages.length ? "No text could be read from the scanned pages." : "No text was found in this file.");
      if (chunks.length > lim.maxChunks) return fail(bid, id, `This file is too long to index on the free plan (${chunks.length} passages; the most is ${lim.maxChunks}). Try a shorter document.`);
      await saveText(bid, id, ex.text, ex.noPages ? null : startsOf(ex.pages));
      await replaceChunks(bid, id, chunks);
      await patchDoc(bid, id, { pages: ex.pageCount, chunk_count: chunks.length, embedded_count: 0, size_bytes: size, status_detail: null });
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
