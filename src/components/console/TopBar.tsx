"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

// Top bar of the Acts & Judgments workspace: product switcher, country selector and a "Data API" link. Original layout, our own markup and icons.
// The current product comes from the shell that renders the bar (ConsoleShell variant): the Legal Workspace pages use the "lawspace" shell, everything else is Legal Data & API.
// Countries other than India are listed as "Coming soon" and are not selectable: only Indian data exists, so nothing here switches any data.
export const PRODUCTS = [
  { id: "data", name: "Legal Data & API", sub: "Acts, judgments and legal data, by API.", href: "/developer?tab=overview", soon: false },
  { id: "workspace", name: "Legal Workspace", sub: "Research, draft and review in one place.", href: "/workspace", soon: false },
];
export const COUNTRIES = [
  { id: "in", name: "India", flag: "🇮🇳", current: true, soon: false },
  { id: "us", name: "United States", flag: "🇺🇸", current: false, soon: true },
  { id: "gb", name: "United Kingdom", flag: "🇬🇧", current: false, soon: true },
];
export const TOP_LINKS = [{ label: "Data API", href: "/developer?tab=overview" }];

type Item = { id: string; label: string; sub?: string; flag?: string; checked: boolean; soon: boolean; href?: string };
const Chevron = () => <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted"><path d="M6 9l6 6 6-6" /></svg>;

function TopMenu({ title, ariaLabel, items, open, setOpen, testid, trigger, triggerClass }: { title: string; ariaLabel: string; items: Item[]; open: boolean; setOpen: (o: boolean) => void; testid: string; trigger: React.ReactNode; triggerClass: string }) {
  const here = usePathname(), root = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), refs = useRef<(HTMLElement | null)[]>([]), uid = useId();
  const close = (refocus: boolean) => { setOpen(false); if (refocus) btn.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    refs.current[Math.max(0, items.findIndex((i) => i.checked))]?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (to: number) => refs.current[(to + items.length) % items.length]?.focus();
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(items.length - 1); }
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const it = items[i]; if (!it.soon) { if (it.href && it.href.split("?")[0] !== here) refs.current[i]?.click(); else close(true); } }
  };
  return (
    <div ref={root} className="sm:relative">
      <button ref={btn} type="button" data-testid={testid} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? uid : undefined} aria-label={ariaLabel}
        onClick={() => setOpen(!open)} onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); setOpen(true); } else if (open && e.key === "Escape") close(true); }}
        className={triggerClass}>{trigger}</button>
      {open && (
        <div id={uid} role="menu" aria-label={title} className="console-pop absolute left-4 right-4 top-full z-[105] mt-1 rounded-xl bg-surface p-1.5 text-fs-ui text-foreground shadow-lg ring-1 ring-border sm:left-0 sm:right-auto sm:w-[320px]">
          <p aria-hidden className="px-3 pb-1 pt-2 text-fs-nano font-semibold uppercase tracking-caps-mid text-muted">{title}</p>
          {items.map((it, i) => {
            const cls = `flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:bg-accent ${it.soon ? "cursor-not-allowed text-muted" : "cursor-pointer hover:bg-accent"}`;
            const body = <>
              {it.flag && <span aria-hidden className="text-fs-xl leading-5">{it.flag}</span>}
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 font-medium">{it.label}{it.soon && <span className="rounded-full bg-accent px-2 py-0.5 text-fs-nano font-medium text-muted ring-1 ring-border">Coming soon</span>}</span>{it.sub && <span className="mt-0.5 block text-fs-sm font-normal text-muted">{it.sub}</span>}</span>
              <span aria-hidden className="w-4 shrink-0 text-center text-fs-ui text-primary">{it.checked ? "✓" : ""}</span>
            </>;
            const common = { role: "menuitemradio" as const, "aria-checked": it.checked, "aria-disabled": it.soon || undefined, tabIndex: -1, onKeyDown: (e: React.KeyboardEvent) => onKey(e, i), className: cls };
            return it.href && !it.soon && it.href.split("?")[0] !== here   // the page you are already on just closes the menu
              ? <Link key={it.id} href={it.href} ref={(el) => { refs.current[i] = el; }} {...common} onClick={() => setOpen(false)}>{body}</Link>
              : <div key={it.id} ref={(el) => { refs.current[i] = el; }} {...common} onClick={() => { if (!it.soon) close(true); }}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ product: current }: { product: "data" | "workspace" }) {
  const [open, setOpen] = useState<"product" | "country" | null>(null);   // one menu at a time
  const product = PRODUCTS.find((p) => p.id === current) ?? PRODUCTS[0], country = COUNTRIES.find((c) => c.current) ?? COUNTRIES[0];
  const pill = "flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-fs-ui ring-1 ring-border hover:bg-accent focus-visible:outline-2";
  return (
    <>
      <TopMenu title="Switch product" ariaLabel={`Switch product, current: ${product.name}`} testid="product-switcher" open={open === "product"} setOpen={(o) => setOpen(o ? "product" : null)}
        items={PRODUCTS.map((p) => ({ id: p.id, label: p.name, sub: p.sub, checked: p.id === current, soon: p.soon, href: p.href }))}
        triggerClass={pill} trigger={<><span className="rounded-full bg-primary px-2.5 py-1 text-fs-nano font-semibold uppercase tracking-wide text-white">Product</span><span className="font-medium">{product.name}</span><Chevron /></>} />
      <TopMenu title="Country" ariaLabel={`Country, current: ${country.name}`} testid="country-switcher" open={open === "country"} setOpen={(o) => setOpen(o ? "country" : null)}
        items={COUNTRIES.map((c) => ({ id: c.id, label: c.name, flag: c.flag, checked: c.current, soon: c.soon }))}
        triggerClass="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-fs-ui ring-1 ring-border hover:bg-accent focus-visible:outline-2" trigger={<><span aria-hidden className="text-fs-lead leading-none">{country.flag}</span><Chevron /></>} />
      <nav aria-label="Top links" className="ml-auto flex items-center gap-1">
        {TOP_LINKS.map((l) => <Link key={l.label} href={l.href} className="inline-flex min-h-9 items-center rounded-lg px-3 text-fs-ui font-medium text-foreground hover:bg-accent">{l.label}</Link>)}
      </nav>
    </>
  );
}
