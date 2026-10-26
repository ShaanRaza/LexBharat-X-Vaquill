"use client";
import { useEffect, useRef, useState } from "react";

/** "Copy page" split button from the reference page header: copies the article text; the chevron opens a second action (copy link). */
export default function CopyPage() {
  const [state, setState] = useState<"" | "page" | "link" | "fail">("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const copy = async (what: "page" | "link") => {
    const text = what === "page" ? (document.querySelector("article")?.innerText ?? "") : location.href;
    try { await navigator.clipboard.writeText(text); setState(what); } catch { setState("fail"); }
    setOpen(false); setTimeout(() => setState(""), 1800);
  };
  const base = "inline-flex h-[34px] items-center border border-border bg-legacy-f4f1ec text-soft transition-colors hover:bg-raised";
  return (
    <div ref={root} className="relative shrink-0">
      <div className="inline-flex" role="group" aria-label="Copy page options">
        <button type="button" onClick={() => copy("page")} className={`${base} gap-2 rounded-l-xl px-3 text-fs-ui`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>
          <span aria-live="polite">{state === "page" ? "Copied" : state === "link" ? "Link copied" : state === "fail" ? "Copy failed" : "Copy page"}</span>
        </button>
        <button type="button" aria-label="More copy options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${base} -ml-px w-9 justify-center rounded-r-xl`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-border bg-surface p-1 text-fs-ui shadow-lg">
          <button role="menuitem" type="button" onClick={() => copy("page")} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-raised">Copy page</button>
          <button role="menuitem" type="button" onClick={() => copy("link")} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-raised">Copy page link</button>
        </div>
      )}
    </div>
  );
}
