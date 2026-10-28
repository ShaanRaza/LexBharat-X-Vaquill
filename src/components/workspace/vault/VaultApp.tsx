"use client";
import Link from "next/link";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";
import { useMemo, useState } from "react";
import { Button, Notice, Panel } from "@/components/kit";
import { MB } from "@/lib/vault/files.mjs";
import type { VaultDoc } from "@/lib/vault/store";
import DocActions from "./DocActions";
import DocStatus from "./DocStatus";
import UploadButton from "./UploadButton";
import { useJustReady } from "./useJustReady";
import { useVault } from "./useVault";

// The Vault page (/workspace/vault): add documents, see their status, search by name, sort, rename, download, delete. Presentation only; data and background work are in useVault.
const SORTS = { newest: "Newest first", oldest: "Oldest first", name: "Name (A to Z)", size: "Largest first" } as const;
type Sort = keyof typeof SORTS;
const size = (b: number) => (b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const TYPE = { pdf: "PDF", docx: "Word", txt: "Text", jpg: "Picture", png: "Picture" } as const;
const BTN = "rounded-chip px-2.5 py-2 text-ui-sm text-secondary hover:bg-accent focus-visible:outline-2";
const backToRename = (id: string) => requestAnimationFrame(() => setTimeout(() => document.getElementById(`rb-${id}`)?.focus(), 0));   // keep keyboard focus on the row after the edit box closes

export default function VaultApp() {
  const v = useVault(), [q, setQ] = useState(""), [sort, setSort] = useState<Sort>("newest"), [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState(""), [err, setErr] = useState("");
  const docs = useMemo(() => {
    const list = (v.state?.docs ?? []).filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()));
    return [...list].sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.sizeBytes - a.sizeBytes : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  }, [v.state, q, sort]);
  async function save(d: VaultDoc) { const e = await v.rename(d.id, draft); if (e) setErr(e); else { setErr(""); setEditing(null); backToRename(d.id); } }
  async function del(d: VaultDoc) { if (window.confirm(`Delete “${d.name}”? The file, its text and its search data are removed for good. Reviews already made from it stay in Review until you delete them.`)) await v.remove(d.id); }
  const lim = v.state?.limits, fresh = useJustReady(v.state?.docs);
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Saved on this browser only.</strong> Testing phase: don&apos;t upload confidential client documents.</p></Notice>
      <h1 className="mt-6 text-ui-title font-semibold">Vault</h1>
      <p className="mt-2 text-ui-body text-secondary">Keep your own documents here, then attach them to a chat question or review them as contracts. PDF, Word, text and picture (JPG, PNG) files, up to {lim?.maxFileMb ?? 10} MB each. Scanned pages are read by a model (at most 20 scanned pages per document and 5 scanned documents a day) and marked &quot;Read from scan — check the original&quot;.</p>
      {v.state && !v.state.ready && <Notice tone="warn" role="status" className="mt-4"><p>The Vault is not set up on this server yet (no storage configured).</p></Notice>}
      {v.failed && <Notice tone="bad" role="alert" className="mt-4"><p>Could not load the Vault. Reload the page.</p></Notice>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <UploadButton onFiles={v.upload} />
        <p className="text-ui-sm text-muted">{lim ? `${v.state!.docs.length} of ${lim.maxDocs} documents · ${(v.state!.usedBytes / MB).toFixed(1)} of ${lim.maxTotalMb} MB used` : ""}</p>
      </div>
      <ul className="mt-3 space-y-2" aria-live="polite">{v.notes.map((n, i) => <li key={i}><Notice tone={n.ok ? "complete" : "bad"} role={n.ok ? "status" : "alert"} compact><p><strong className="font-medium text-foreground">{n.name}:</strong> {n.message}</p></Notice></li>)}</ul>

      <ul className="mt-3 space-y-2" aria-live="polite">{fresh.ready.map((d) => <li key={d.id}><Notice tone="complete" role="status" compact><p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span><strong className="font-medium text-foreground">{d.name}:</strong> Ready. Ask a question about it or run a review.</span><Button variant="quiet" size="sm" onClick={() => fresh.dismiss(d.id)} aria-label={`Dismiss the note about ${d.name}`}>Dismiss</Button></p></Notice></li>)}</ul>

      <section aria-labelledby="docs" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="docs" className="text-ui-lead font-semibold">Your documents</h2>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="vault-q">Search documents by name</label>
            <input id="vault-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="h-10 w-44 rounded-input bg-surface px-3 text-ui-base ring-1 ring-control-border focus-visible:outline-2" />
            <label className="sr-only" htmlFor="vault-sort">Sort documents</label>
            <select id="vault-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 rounded-input bg-surface px-2 text-ui-base ring-1 ring-control-border focus-visible:outline-2">{Object.entries(SORTS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          </div>
        </div>
        {err && <Notice tone="bad" role="alert" compact className="mt-3"><p>{err}</p></Notice>}
        <Panel as="div" className="mt-3 px-card py-2">
          {v.state && v.state.docs.length === 0 && <p className="py-4 text-center text-ui-base text-secondary">No documents yet. Add a PDF, Word, text, JPG or PNG file to start.</p>}
          {v.state && v.state.docs.length > 0 && docs.length === 0 && <p className="py-4 text-center text-ui-base text-secondary">No document matches “{q}”.</p>}
          {!v.state && !v.failed && <p className="py-4 text-ui-base text-muted">Loading…</p>}
          <ul className="divide-y divide-border/60">
            {docs.map((d) => (
              <li key={d.id} className="py-3">
                {editing === d.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); save(d); }} className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`rn-${d.id}`}>New name for {d.name}</label>
                    <input id={`rn-${d.id}`} autoFocus value={draft} maxLength={120} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setEditing(null); backToRename(d.id); } }} className="h-10 min-w-0 flex-1 rounded-input bg-surface px-3 text-ui-base ring-1 ring-control-border focus-visible:outline-2" />
                    <button type="submit" className="h-10 rounded-button bg-primary px-4 text-ui-base font-medium text-on-primary">Save</button>
                    <button type="button" onClick={() => { setEditing(null); backToRename(d.id); }} className={BTN}>Cancel</button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/workspace/vault/${d.id}`} className="min-w-0 flex-1 basis-48 truncate text-ui-body font-medium hover:text-primary focus-visible:outline-2">{d.name}</Link>
                    <DocStatus doc={d} note={v.wait[d.id]} />
                    <div className="flex gap-1">
                      <button type="button" id={`rb-${d.id}`} onClick={() => { setEditing(d.id); setDraft(d.name); setErr(""); }} className={BTN} aria-label={`Rename ${d.name}`}>Rename</button>
                      <button type="button" onClick={() => v.download(d.id)} className={BTN} aria-label={`Download ${d.name}`}>Download</button>
                      <button type="button" onClick={() => del(d)} className={BTN} aria-label={`Delete ${d.name}`}>Delete</button>
                    </div>
                  </div>
                )}
                <p className="mt-1 text-ui-sm text-muted">{TYPE[d.kind]} · {size(d.sizeBytes)} · {d.pages ? `${d.pages} page${d.pages === 1 ? "" : "s"}` : d.kind === "pdf" ? "pages: not known yet" : "no page numbers"} · added {when(d.createdAt)}</p>
                {d.status === "ready" && editing !== d.id && <DocActions id={d.id} name={d.name} scanned={d.scanned} />}
                {d.status === "unreadable" && d.statusDetail && <p className="mt-1 text-ui-sm text-quality-bad">{d.statusDetail}</p>}
                {d.scanned && d.status === "ready" && <p className="mt-1 text-ui-sm text-quality-warn">{SCAN_LABEL}{d.scanSkipped > 0 ? `. ${d.scanSkipped} scanned page${d.scanSkipped === 1 ? " was" : "s were"} not read (limit per document).` : "."}</p>}
                {d.status === "waiting" && <p className="mt-1 text-ui-sm text-quality-warn">{d.statusDetail || "Waiting to read. It will carry on by itself."} You can leave this page; it carries on when you come back.</p>}
                {d.status === "processing" && <p className="mt-1 text-ui-sm text-muted">{v.wait[d.id] || d.statusDetail || (d.chunkCount ? "Preparing it for search. You can leave this page; it carries on when you come back." : "Reading the file…")}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
