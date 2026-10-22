"use client";

// The one search bar used on every judgments surface (browse page, court-year pages): a wide rounded bar with a magnifier at the left and a clear button at the right,
// laid out like the reference app's "Try ..." search field. Typing searches as you go (the caller debounces); Enter searches at once; Escape clears.
export default function SearchField({ id, value, onChange, placeholder, label, onSubmit, className = "" }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; label: string; onSubmit?: () => void; className?: string }) {
  return (
    <form role="search" aria-label={label} onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }} className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#65625f]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value.slice(0, 200))} onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); onChange(""); } }}
        placeholder={placeholder} maxLength={200} autoComplete="off" enterKeyHint="search" spellCheck={false}
        className="h-12 w-full rounded-xl bg-accent pl-11 pr-11 text-[15px] outline-none ring-1 ring-transparent placeholder:text-[#65625f] focus:bg-surface focus:ring-primary/50 [&::-webkit-search-cancel-button]:hidden" />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#65625f] hover:bg-border/50">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
    </form>
  );
}
