"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Notice, Panel } from "@/components/kit";
import { pageAt } from "@/lib/vault/chunk.mjs";
import type { VaultDoc } from "@/lib/vault/store";
import DocStatus from "./DocStatus";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";
import { cleanPlain } from "@/lib/text/clean.mjs";

// A document's text preview (/work/vault/<id>?page=N). PDFs show their text page by page; Word and text files show the text. Presentation only.
type Detail = { doc: VaultDoc; text: string | null; truncated: boolean; pageStarts: number[] | null; scanPages?: number[] };
export default function DocView({ id }: { id: string }) {
  const [d, setD] = useState<Detail | null>(null), [err, setErr] = useState(""), target = useRef<HTMLElement>(null);
  useEffect(() => { fetch(`/api/vault/${id}`, { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error("This document was not found on this browser."); setD(await r.json()); }).catch((e) => setErr(e.message)); }, [id]);
  const want = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("page")) || 0;
  useEffect(() => { target.current?.scrollIntoView({ block: "start" }); }, [d]);
  async function download() { const r = await fetch(`/api/vault/${id}/download`, { cache: "no-store" }), j = await r.json().catch(() => ({})); if (j.url) window.location.assign(j.url); }
  const pages = d?.text && d.pageStarts ? d.pageStarts.map((s, i) => cleanPlain(d.text!.slice(s, d.pageStarts![i + 1] ?? undefined))) : null;   // cleaned page by page: the page offsets are for the raw text
  return (
    <div className="mx-auto max-w-3xl pb-10">
      <p className="mt-3 text-ui-sm"><Link href="/work/vault" className="text-primary hover:underline">← Back to the Vault</Link></p>
      {err && <Notice tone="bad" role="alert" className="mt-4"><p>{err}</p></Notice>}
      {!d && !err && <p className="mt-6 text-ui-base text-muted">Loading…</p>}
      {d && (
        <>
          <h1 className="mt-4 break-words text-ui-title font-semibold">{d.doc.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-ui-sm text-muted"><DocStatus doc={d.doc} /> {d.doc.pages ? `${d.doc.pages} pages` : ""}
            <button type="button" onClick={download} className="rounded-chip px-2 py-1 text-ui-sm text-primary hover:bg-accent focus-visible:outline-2">Download the original</button></p>
          {d.doc.status === "unreadable" && <Notice tone="bad" role="alert" className="mt-4"><p>{d.doc.statusDetail}</p></Notice>}
          {d.doc.scanned && <Notice tone="warn" role="note" compact className="mt-4"><p><strong className="font-medium text-foreground">{SCAN_LABEL}.</strong> {d.doc.scanSkipped > 0 ? `${d.doc.scanTotal} scanned page${d.doc.scanTotal === 1 ? " was" : "s were"} read by a model; ${d.doc.scanSkipped} more scanned page${d.doc.scanSkipped === 1 ? " was" : "s were"} not read (the limit per document). ` : "Scanned pages were read by a model and can contain mistakes. "}Download the original to check.</p></Notice>}
          {d.truncated && <Notice tone="info" compact className="mt-4"><p>Only the first part of a very long document is shown here.</p></Notice>}
          {pages ? pages.map((t, i) => (
            <Panel as="article" key={i} className="mt-4"><h2 ref={want === i + 1 ? (target as React.RefObject<HTMLHeadingElement>) : undefined} id={`p${i + 1}`} className="text-ui-sm font-semibold uppercase tracking-caps text-muted">Page {i + 1}{d.scanPages?.includes(i + 1) && <span className="ml-2 font-normal normal-case tracking-normal text-quality-warn">· {SCAN_LABEL}</span>}</h2><p className="mt-2 whitespace-pre-wrap text-ui-body leading-relaxed">{t}</p></Panel>
          )) : d.text ? <Panel as="article" className="mt-4"><p className="whitespace-pre-wrap text-ui-body leading-relaxed">{cleanPlain(d.text)}</p></Panel> : null}
        </>
      )}
    </div>
  );
}
