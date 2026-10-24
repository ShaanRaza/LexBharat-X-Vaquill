"use client";
// Vault data and background work for the pages (no markup here). Loads the list, uploads files straight to storage with a short-lived URL, and keeps reading/embedding any document that is still
// "Processing" by calling /api/vault/<id>/process step by step (also after a reload, so an interrupted document simply resumes).
import { useCallback, useEffect, useRef, useState } from "react";
import { KINDS, checkUpload, kindFromName } from "@/lib/vault/files.mjs";
import type { VaultDoc } from "@/lib/vault/store";

export type VaultState = { ready: boolean; docs: VaultDoc[]; limits: { maxDocs: number; maxTotalMb: number; maxFileMb: number }; usedBytes: number };
export type UploadNote = { name: string; ok: boolean; message: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useVault() {
  const [state, setState] = useState<VaultState | null>(null), [failed, setFailed] = useState(false), [notes, setNotes] = useState<UploadNote[]>([]), [wait, setWait] = useState<Record<string, string>>({});
  const running = useRef(false), alive = useRef(true), [tick, setTick] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;   // always the latest list, also inside effects that run in the same commit
  const reload = useCallback(async () => {
    try { const r = await fetch("/api/vault", { cache: "no-store" }), j = await r.json(); if (!alive.current) return; setState(j); setFailed(!r.ok && !j.docs); }
    catch { if (alive.current) setFailed(true); }
  }, []);
  useEffect(() => { alive.current = true; reload(); return () => { alive.current = false; }; }, [reload]);

  // keep working on documents that are still processing (one at a time, so the free embedding limit is respected)
  const docsKey = (state?.docs ?? []).filter((d) => d.status === "processing").map((d) => d.id).join(",");
  useEffect(() => {
    if (!docsKey || running.current) return;
    running.current = true;
    (async () => {
      try {
        for (;;) {
          const next = (stateRef.current?.docs ?? []).find((d) => d.status === "processing"); if (!next || !alive.current) break;
          let r: Response | null = null;
          try { r = await fetch(`/api/vault/${next.id}/process`, { method: "POST" }); } catch { await sleep(5000); continue; }
          if (r.status === 404) { await reload(); continue; }
          const j = await r.json().catch(() => ({}));
          if (j.doc) setState((s) => s && { ...s, docs: s.docs.map((d) => (d.id === j.doc.id ? j.doc : d)) });
          setWait((w) => ({ ...w, [next.id]: j.state === "embedding" || j.state === "waiting" ? j.message ?? "" : "" }));
          if (j.state === "gone" || j.state === "ready" || j.state === "unreadable") { await reload(); window.dispatchEvent(new Event("lb-vault-changed")); }
          if (j.waitMs) await sleep(Math.min(j.waitMs, 40000));
        }
      } finally { running.current = false; if (alive.current && (stateRef.current?.docs ?? []).some((d) => d.status === "processing")) setTimeout(() => alive.current && setTick((t) => t + 1), 2000); }   // never stay stuck on a document that is still processing
    })();
  }, [docsKey, reload, tick]);

  const upload = useCallback(async (files: File[]) => {
    const out: UploadNote[] = [];
    for (const f of files) {
      const cur = stateRef.current, lim = cur?.limits;
      const pre = lim ? checkUpload({ name: f.name, size: f.size }, cur!.docs, { maxDocs: lim.maxDocs, maxTotalMb: lim.maxTotalMb, maxFileMb: lim.maxFileMb }) : { ok: !!kindFromName(f.name), message: "Only PDF, Word (.docx) and text (.txt) files can be added." };
      if (!pre.ok) { out.push({ name: f.name, ok: false, message: pre.message }); continue; }
      try {
        const r = await fetch("/api/vault", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: f.name, size: f.size }) }), j = await r.json();
        if (!r.ok) { out.push({ name: f.name, ok: false, message: j.error || "Could not upload." }); continue; }
        const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([f], { type: KINDS[kindFromName(f.name)!].mime }), f.name);   // the bucket only accepts these exact types, and some browsers leave a .docx untyped
        const put = await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
        if (!put.ok) { await fetch(`/api/vault/${j.id}`, { method: "DELETE" }).catch(() => null); out.push({ name: f.name, ok: false, message: "The upload did not go through. Please try again." }); continue; }
        out.push({ name: f.name, ok: true, message: "Uploaded. Reading it now…" });
        await reload();
      } catch { out.push({ name: f.name, ok: false, message: "The upload did not go through. Please try again." }); }
    }
    setNotes(out); window.dispatchEvent(new Event("lb-vault-changed"));
    setTimeout(() => setNotes((n) => n.filter((x) => !x.ok)), 5000);   // "Uploaded" is only worth a few seconds; the list shows the status after that
    return out;
  }, [reload]);

  const rename = useCallback(async (id: string, name: string) => { const r = await fetch(`/api/vault/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); const j = await r.json().catch(() => ({})); if (!r.ok) return j.error || "Could not rename."; await reload(); return ""; }, [reload]);
  const remove = useCallback(async (id: string) => { const r = await fetch(`/api/vault/${id}`, { method: "DELETE" }); if (!r.ok) return false; await reload(); window.dispatchEvent(new Event("lb-vault-changed")); return true; }, [reload]);
  const download = useCallback(async (id: string) => { const r = await fetch(`/api/vault/${id}/download`, { cache: "no-store" }), j = await r.json().catch(() => ({})); if (j.url) window.location.assign(j.url); return r.ok; }, []);
  return { state, failed, notes, setNotes, wait, reload, upload, rename, remove, download };
}
