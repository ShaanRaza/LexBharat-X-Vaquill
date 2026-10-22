"use client";
import { useEffect, useState } from "react";

// The one search bar used on every judgments surface (browse page, court-year pages): a wide rounded bar with a magnifier at the left and a clear button at the right,
// laid out like the reference app's "Try ..." search field. Typing searches as you go (the caller debounces); Enter searches at once; Escape clears.
// Shared control styles (white field, 1.5px visible border, brand-brown border + tint when a filter is changed from its default).
export const filterLabel = "text-[12px] font-medium text-[#3f3a35]";
export const filterSelect = (active: boolean) => `h-11 rounded-xl border-[1.5px] px-3 text-[14px] text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 ${active ? "border-primary bg-primary/10 font-medium" : "border-[color:var(--control-border)] bg-surface"}`;
export const clearFiltersCls = "inline-flex min-h-11 items-center self-end rounded-lg px-2 text-[14px] font-medium text-primary underline underline-offset-2 hover:bg-accent";

export default function SearchField({ id, value, onChange, placeholder, label, onSubmit, className = "", shortPlaceholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; shortPlaceholder?: string; label: string; onSubmit?: () => void; className?: string }) {
  const [phone, setPhone] = useState(false);   // phones get the short placeholder so it is not cut off; desktop keeps the full one
  useEffect(() => { const mq = window.matchMedia("(max-width: 480px)"), f = () => setPhone(mq.matches); f(); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return (
    <form role="search" aria-label={label} onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#3f3a35]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value.slice(0, 200))} onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
        placeholder={phone && shortPlaceholder ? shortPlaceholder : placeholder} maxLength={200} autoComplete="off" enterKeyHint="search" spellCheck={false}
        className="h-[54px] w-full rounded-xl border-[1.5px] border-[color:var(--control-border)] bg-surface pl-12 pr-12 text-[16px] text-foreground outline-none placeholder:text-[#5b5650] focus:border-primary focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden" />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[#3f3a35] hover:bg-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
    </form>
  );
}
