"use client";
import { useEffect, useId, useRef, useState } from "react";

export type LbItem =
  | { kind: "group"; label: string }
  | { kind: "sub"; label: string }
  | { kind: "option"; value: string; label: React.ReactNode; text?: string };

type Props = {
  items: LbItem[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  id?: string;
  triggerClass?: string;
  triggerContent: React.ReactNode;
  panelClass?: string;
  maxHeight?: string;
};

/** Small accessible select (listbox pattern): arrow keys, Enter/Space, Escape, type-ahead on option text, click outside to close. */
export default function Listbox({ items, value, onChange, ariaLabel, id, triggerClass, triggerContent, panelClass = "w-full", maxHeight = "max-h-72" }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const uid = useId();
  const opts = items.map((it, i) => ({ it, i })).filter((x) => x.it.kind === "option") as { it: Extract<LbItem, { kind: "option" }>; i: number }[];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sel = Math.max(0, opts.findIndex((o) => o.it.value === value));
    setActive(sel);
    requestAnimationFrame(() => { panel.current?.focus(); panel.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (open) panel.current?.querySelector(`[data-opt="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const choose = (v: string) => { onChange(v); setOpen(false); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(opts.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (opts[active]) choose(opts[active].it.value); }
    else if (e.key.length === 1) {
      const q = e.key.toLowerCase();
      const from = opts.findIndex((o, n) => n > active && (o.it.text ?? "").toLowerCase().startsWith(q));
      const any = from >= 0 ? from : opts.findIndex((o) => (o.it.text ?? "").toLowerCase().startsWith(q));
      if (any >= 0) setActive(any);
    }
  };

  return (
    <div ref={root} className="relative">
      <button ref={btn} id={id} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? uid : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setOpen(true); } }}
        className={triggerClass}>
        {triggerContent}
      </button>
      {open && (
        <div ref={panel} id={uid} role="listbox" data-lenis-prevent tabIndex={-1} aria-label={ariaLabel} aria-activedescendant={active >= 0 ? `${uid}-${active}` : undefined} onKeyDown={onKey}
          className={`console-pop absolute left-0 top-full z-[105] mt-1 overflow-y-auto rounded-panel bg-surface p-1 text-fs-ui text-foreground shadow-md outline-none ring-1 ring-border ${maxHeight} ${panelClass}`}>
          {items.map((it, i) => {
            if (it.kind === "group") return <div key={`g${i}`} role="presentation" className="py-1.5 pl-8 pr-2 text-fs-nano font-semibold uppercase tracking-wide text-muted">{it.label}</div>;
            if (it.kind === "sub") return <div key={`s${i}`} role="presentation" className="my-1 rounded-control bg-accent px-3 py-1 text-fs-xs text-muted">{it.label}</div>;
            const n = opts.findIndex((o) => o.i === i);
            const sel = it.value === value;
            return (
              <div key={`o${i}`} id={`${uid}-${n}`} data-opt={n} role="option" aria-selected={sel}
                onMouseEnter={() => setActive(n)} onClick={() => choose(it.value)}
                className={`relative flex w-full cursor-pointer select-none rounded-control py-1.5 pl-8 pr-2 ${active === n ? "bg-accent" : ""}`}>
                {sel && <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fs-sm">✓</span>}
                <div className="min-w-0 flex-1">{it.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
