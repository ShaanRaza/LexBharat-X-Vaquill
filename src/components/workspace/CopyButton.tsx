"use client";
import { useState } from "react";

// Copies text to the clipboard (with a fallback for pages without clipboard access). Used for citations and case references.
export default function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch { /* nothing more to try */ } t.remove(); }
    setDone(true); setTimeout(() => setDone(false), 1500);
  }
  return <button type="button" onClick={copy} aria-label={`${label}: ${text}`} title={label} className={`inline-flex min-h-6 items-center rounded-md px-1.5 text-[11px] text-[#535151] ring-1 ring-border hover:bg-accent ${className}`}>{done ? "Copied" : "Copy"}</button>;
}
