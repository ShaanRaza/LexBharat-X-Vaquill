"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { VaultDoc } from "@/lib/vault/store";

// "Attach from Vault" for ONE chat question: pick up to 3 documents from this browser's Vault. The choice belongs to the next question only (the chat clears it when the question is sent).
// Presentation only; the chat page sends the chosen ids and the server searches those documents. Colours, sizes and radii come from the tokens.
export type Attached = { id: string; name: string };
export const MAX_ATTACH = 3;

export default function AttachPicker({ value, onChange, disabled }: { value: Attached[]; onChange: (v: Attached[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [docs, setDocs] = useState<VaultDoc[] | null>(null), [failed, setFailed] = useState(false), id = useId(), box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    fetch("/api/vault", { cache: "no-store" }).then((r) => r.json()).then((j) => { setDocs(j.docs ?? []); setFailed(false); }).catch(() => setFailed(true));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };   // focus goes back to the button that opened the list
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const has = (docId: string) => value.some((v) => v.id === docId);
  const toggle = (d: VaultDoc) => onChange(has(d.id) ? value.filter((v) => v.id !== d.id) : value.length < MAX_ATTACH ? [...value, { id: d.id, name: d.name }] : value);
  return (
    <div ref={box} className="relative">
      <button ref={btn} type="button" disabled={disabled} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}
        className="h-9 rounded-chip bg-surface px-3 text-ui-sm text-secondary ring-1 ring-control-border hover:bg-accent focus-visible:outline-2 disabled:opacity-50">
        Attach from Vault{value.length ? ` (${value.length})` : ""}
      </button>
      {open && (
        <div id={id} role="group" aria-label="Documents in your Vault" className="absolute bottom-11 left-0 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-panel bg-surface p-3 shadow-lg ring-1 ring-border">
          {failed && <p className="text-ui-sm text-quality-bad">Could not load your Vault.</p>}
          {!docs && !failed && <p className="text-ui-sm text-muted">Loading…</p>}
          {docs && docs.length === 0 && <p className="text-ui-sm text-secondary">Your Vault is empty. <Link href="/workspace/vault" className="text-primary hover:underline">Add a document</Link> first.</p>}
          {docs && docs.length > 0 && (
            <>
              <ul className="max-h-60 space-y-1 overflow-y-auto" data-lenis-prevent>
                {docs.map((d) => {
                  const usable = d.status !== "unreadable" && d.chunkCount > 0, full = !has(d.id) && value.length >= MAX_ATTACH;
                  return (
                    <li key={d.id}>
                      <label className={`flex items-start gap-2 rounded-chip px-2 py-1.5 text-ui-sm ${usable && !full ? "cursor-pointer hover:bg-accent" : "opacity-60"}`}>
                        <input type="checkbox" checked={has(d.id)} disabled={!usable || full} onChange={() => toggle(d)} className="mt-0.5" />
                        <span className="min-w-0"><span className="block truncate text-foreground">{d.name}</span>
                          <span className="block text-ui-xs text-muted">{d.status === "unreadable" ? "Can't read" : d.status === "processing" ? (d.chunkCount ? `Still preparing ${d.embeddedCount}/${d.chunkCount} (keyword search only)` : "Still being read") : d.pages ? `${d.pages} pages` : "Ready"}</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-ui-xs text-muted">Up to {MAX_ATTACH} documents, for the next question only.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
