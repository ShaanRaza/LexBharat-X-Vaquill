"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";

// "Your documents" on the Search page: passages of THIS browser's own Vault files that match, with the file name and page (GET /api/vault/search). Presentation and fetching only.
type Passage = { id: string; docId: string; docName: string; page: number | null; label: string | null; text: string; scan: boolean; via: "meaning" | "keywords" };
type Resp = { ready?: boolean; docs: number; passages: Passage[]; mode?: string; error?: string };

export default function DocsSearchResults({ q, exact, onCount }: { q: string; exact: boolean; onCount?: (n: number | null) => void }) {
  const [data, setData] = useState<Resp | null>(null), [err, setErr] = useState("");
  useEffect(() => {
    const ac = new AbortController(), t = setTimeout(() => {
      setErr(""); setData(null);
      fetch(`/api/vault/search?q=${encodeURIComponent(q)}${exact ? "&exact=1" : ""}`, { signal: ac.signal }).then(async (r) => {
        const j = (await r.json().catch(() => null)) as Resp | null;
        if (!r.ok || !j) throw new Error(j?.error ?? `Search failed (status ${r.status}).`);
        setData(j); onCount?.(j.passages.length);
      }).catch((e) => { if ((e as Error).name !== "AbortError") { setErr((e as Error).message || "Search failed."); onCount?.(null); } });
    }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q, exact]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section aria-label="Passages in your documents" className="mt-6">
      {err && <Notice tone="bad" role="alert"><p>{err}</p></Notice>}
      {!data && !err && <div className="space-y-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="console-skel h-20 rounded-card bg-accent" />)}</div>}
      {data && data.ready === false && <Notice tone="info" role="status"><p>Your documents are not set up on this server yet.</p></Notice>}
      {data && data.ready !== false && data.docs === 0 && <Notice tone="info" role="status"><p>You have no ready documents in your Vault. <Link href="/work/vault" className="font-medium text-primary underline">Add documents in Work ›</Link></p></Notice>}
      {data && data.docs > 0 && (
        <>
          <p className="text-ui-sm text-muted">Searched {data.docs} of your {data.docs === 1 ? "document" : "documents"}{data.mode === "meaning+keywords" ? " by meaning and by exact words" : " by exact words"}. Only you can see these.</p>
          <ul className="mt-3 space-y-2">
            {data.passages.map((p) => (
              <Panel as="li" key={p.id} className="px-card py-4">
                <Link href={`/work/vault/${p.docId}${p.page ? `?page=${p.page}` : ""}`} className="text-ui-body font-medium text-quality-info hover:underline">{p.docName}</Link>
                <p className="mt-0.5 text-ui-sm text-secondary">{p.page ? `Page ${p.page}` : "Document text"}{p.label ? ` · ${p.label}` : ""}</p>
                <p className="mt-2 text-ui-base leading-relaxed text-foreground">{p.text}</p>
                <p className="mt-2 flex flex-wrap gap-1.5">{p.scan && <Badge tone="warn">{SCAN_LABEL}</Badge>}{p.via === "meaning" && <Badge tone="info" title="Found by meaning, not by matching your exact words">By meaning</Badge>}</p>
              </Panel>
            ))}
            {!data.passages.length && <li className="rounded-card border border-dashed border-border p-6 text-center text-ui-base text-muted">No passage in your documents matches.</li>}
          </ul>
        </>
      )}
    </section>
  );
}
