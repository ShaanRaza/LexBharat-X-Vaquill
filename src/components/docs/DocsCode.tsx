"use client";
import { useState } from "react";

/** Dark code block used in the docs: rounded-2xl, comment lines dimmed, copy button at the top right (matches the reference docs' code cards). */
export default function DocsCode({ code, label }: { code: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } };
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-dark text-legacy-f3f0ec">
      {label && <figcaption className="px-5 pt-3 font-mono text-fs-nano uppercase tracking-wider text-legacy-a39c91">{label}</figcaption>}
      <button type="button" onClick={copy} aria-label={done ? "Copied" : "Copy code"} className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-legacy-b5aea3 hover:bg-white/10 hover:text-white">
        {done
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>}
      </button>
      <pre data-lenis-prevent tabIndex={0} className="overflow-x-auto px-5 pb-4 pr-14 pt-3 font-mono text-fs-12.5 leading-6 outline-none focus-visible:ring-1 focus-visible:ring-white/40">
        <code>{code.split("\n").map((l, i) => <span key={i} className={l.trimStart().startsWith("#") ? "text-legacy-8f887e" : undefined}>{l}{"\n"}</span>)}</code>
      </pre>
    </figure>
  );
}
