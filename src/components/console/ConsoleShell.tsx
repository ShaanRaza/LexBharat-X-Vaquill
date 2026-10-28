"use client";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/kit";
import WorkspaceNav, { type LawTab } from "@/components/workspace/WorkspaceNav";

// The signed-in page frame: a collapsible left sidebar (WorkspaceNav) and, on phones, the same menu as a drawer. TEMPORARY: Phase 2 of docs/RESKIN-IA-PLAN.md replaces this with the slim top bar
// and the phone tab bar. The product switcher, the country selector, the "Data API" link and the mock Developer console that used to live here are gone (Phase 1).
function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

export default function ConsoleShell({ lawTab, children }: { lawTab?: LawTab; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);       // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop collapse (chevron)
  const menuBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  // Narrow-screen drawer: Escape closes, page scroll is locked while open, focus moves in and returns to the menu button,
  // Tab stays inside the drawer, and it closes if the window grows to the desktop layout.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    drawer.current?.focus(); // focus the dialog itself so no menu item looks pre-selected
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab" || !drawer.current) return;
      const f = [...drawer.current.querySelectorAll<HTMLElement>("a[href],button")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const mq = window.matchMedia("(min-width: 768px)"); const grow = () => { if (mq.matches) setOpen(false); };
    document.addEventListener("keydown", key); mq.addEventListener("change", grow);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); mq.removeEventListener("change", grow); menuBtn.current?.focus(); };
  }, [open]);

  const logoRow = (
    <div className="flex items-center justify-between px-4 pb-4 pt-5">
      <Logo href="/workspace" className="min-w-0" />
      <button type="button" onClick={() => (open ? setOpen(false) : setCollapsed(true))} aria-label={open ? "Close menu" : "Collapse sidebar"} className="grid size-9 shrink-0 place-items-center rounded-button text-secondary hover:bg-accent hover:text-foreground">
        <Icon d={open ? "M6 6l12 12M18 6L6 18" : "M15 5l-7 7 7 7"} size={16} />
      </button>
    </div>
  );
  const nav = <WorkspaceNav active={lawTab} logo={logoRow} onNavigate={() => setOpen(false)} />;

  return (
    <div className="console min-h-screen">
      <div className="flex">
        {/* desktop sidebar */}
        {!collapsed && <aside className="sticky top-0 hidden h-screen w-sidebar shrink-0 border-r border-border md:block">{nav}</aside>}
        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-[110] md:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
            <aside ref={drawer} tabIndex={-1} data-lenis-prevent role="dialog" aria-modal="true" aria-label="Menu" className="relative h-full w-drawer overflow-y-auto rounded-r-card bg-surface shadow-lg outline-none">{nav}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-8">
            <button ref={menuBtn} type="button" aria-label={collapsed ? "Show sidebar" : "Open menu"} aria-expanded={open} onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setCollapsed((c) => !c) : setOpen(true))} className="rounded-tight p-2 text-muted hover:bg-accent"><Icon d="M4 7h16M4 12h16M4 17h16" /></button>
          </header>
          <main id="main" tabIndex={-1} className="outline-none px-4 pb-24 pt-2 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
