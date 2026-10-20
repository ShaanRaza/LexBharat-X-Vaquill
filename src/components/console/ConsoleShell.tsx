"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearMockSession, useMockSession } from "@/lib/mockSession";

// Layout of the authenticated developer console as captured in docs/PLAYGROUND-TEARDOWN.md: collapsible left sidebar, top bar with a
// hamburger, the "PRODUCT · Data & API" pill and a US-flag jurisdiction picker. Sidebar width, icons and the mobile drawer are INFERRED
// (the teardown only observed ~800 px). The wordmark is typeset text, not the real logo file.

// Tab status (every sidebar item is either a working destination or intentionally disabled):
//   "live"     recreated in this clone (Overview, Playground, API Keys)
//   "bridge"   opens a small in-console page that links to the matching local demo page (Law Change Alerts -> /alerts, MCP Server -> /mcp)
//   "disabled" deliberately not recreated (Credits & Usage, Billing, Settings): shown greyed with a "Not in clone" chip and not clickable;
//              a direct URL shows an explanation page. Billing and credits are out of scope for this clone on purpose.
export type TabStatus = "live" | "bridge" | "disabled";
export const CONSOLE_TABS = [
  { id: "overview", label: "Overview", status: "live" as TabStatus, icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
  { id: "playground", label: "Playground", status: "live" as TabStatus, icon: "M6 4l14 8-14 8z" },
  { id: "law-changes", label: "Law Change Alerts", beta: true, status: "bridge" as TabStatus, icon: "M4 6h12M4 12h8M4 18h12M19 8v8" },
  { id: "api-key", label: "API Keys", status: "live" as TabStatus, icon: "M15 7a4 4 0 1 1-3.5 6L4 20.5V17l2-2v-2l2-2" },
  { id: "credits", label: "Credits & Usage", status: "disabled" as TabStatus, icon: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" },
  { id: "billing", label: "Billing", status: "disabled" as TabStatus, icon: "M3 6h18v12H3zM3 10h18" },
  { id: "mcp", label: "MCP Server", status: "bridge" as TabStatus, icon: "M14 4l6 6M4 20l8-8M10 6l8 8" },
  { id: "settings", label: "Settings", status: "disabled" as TabStatus, icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 12h2M18 12h2M12 4v2M12 18v2" },
] as const;
export type TabId = (typeof CONSOLE_TABS)[number]["id"];
const MAIN_TABS = CONSOLE_TABS.filter((t) => t.id !== "settings");
const SETTINGS_TAB = CONSOLE_TABS.find((t) => t.id === "settings")!;

function NotInClone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span role="link" aria-disabled="true" title="Not part of this local clone" className={`flex cursor-not-allowed items-center gap-3 rounded-[6px] px-3 py-2.5 text-[14px] text-muted/60 ${className}`}>{children}</span>
  );
}
const Chip = ({ children }: { children: React.ReactNode }) => <span className="ml-1.5 whitespace-nowrap rounded-full bg-accent px-1.5 py-0.5 align-middle text-[10px] text-muted ring-1 ring-border">{children}</span>;

const LEARN = [
  { label: "API Docs", href: "/docs" },
  { label: "Coverage", href: "/#coverage" },
  { label: "MCP Guide", href: "/mcp" },
  { label: "Open dataset", href: "/open-us-law" },
];

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

// Workspace variant: the sidebar of the product's "Workspace" area, used by the Acts & Judgments browser (/workspace/browse). Only that page
// is recreated; New Chat, WhatsApp Bot and Settings are shown but disabled, and "Data API" leads back to the developer console.
const BOOKS_ICON = "M5 4h4v16H5zM10 4h4v16h-4zM15.6 5.4l3.6-1 3.2 14.6-3.6 1z";
const WS_ITEMS = [
  { label: "Data API", href: "/developer?tab=overview", icon: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16", state: "link" },
  { label: "Acts & Judgments", href: "/workspace/browse", icon: BOOKS_ICON, state: "active" },
  { label: "WhatsApp Bot", href: "", icon: "M4 20l1.4-4.2A8 8 0 1 1 8.2 18.6L4 20z", state: "disabled" },
] as const;

export default function ConsoleShell({ tab, variant = "data", children }: { tab?: TabId; variant?: "data" | "workspace"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);       // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop collapse (chevron)
  const router = useRouter();
  const session = useMockSession(); // MOCK sign-in record from /auth/login (this browser only), or null
  const menuBtn = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  // Narrow-screen drawer (INFERRED behavior): Escape closes, page scroll is locked while open, focus moves in and returns to the menu button,
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

  const nav = (
    <nav aria-label={variant === "workspace" ? "Workspace" : "Developer console"} className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-4 pt-5">
        <Link href="/developer?tab=overview" className="flex items-baseline gap-0.5 text-[26px] font-medium leading-none tracking-[-0.03em]" aria-label="vaquill AI">
          <svg width="22" height="26" viewBox="0 0 24 28" fill="#6e3730" aria-hidden="true" className="mr-1.5 self-center"><path d="M20 1C9 2 2 9 3 20c0 3 1 6 3 7-1-5 0-10 4-14 3-3 7-4 10-4-5 1-9 4-11 9 5-1 10-5 11-13 .3-1.4.2-3.800 0-4z" /></svg>
          vaquill<sup className="text-[8px] font-normal tracking-normal text-muted">AI</sup>
        </Link>
        <button type="button" onClick={() => (open ? setOpen(false) : setCollapsed(true))} aria-label="Collapse sidebar" className="rounded-[4px] p-1 text-muted hover:bg-accent">
          <Icon d="M15 5l-7 7 7 7" size={16} />
        </button>
      </div>
      {variant === "workspace" ? (
        <>
      <NotInClone className="mx-2 mb-3 !rounded-[8px] border border-border !py-2"><Icon d="M12 5v14M5 12h14" /><span className="leading-tight">New Chat<Chip>Not in clone</Chip></span></NotInClone>
      <ul className="space-y-0.5 px-2">
        {WS_ITEMS.map((it) => (
          <li key={it.label}>
            {it.state === "disabled" ? (
              <NotInClone><Icon d={it.icon} /><span className="leading-tight">{it.label}<Chip>Not in clone</Chip></span></NotInClone>
            ) : (
              <Link href={it.href} onClick={() => setOpen(false)} aria-current={it.state === "active" ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[14px] transition-colors ${it.state === "active" ? "bg-accent text-foreground" : "text-muted hover:bg-accent/60 hover:text-foreground"}`}>
                <Icon d={it.icon} /><span className="leading-tight">{it.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
        </>
      ) : (
        <>
      <ul className="space-y-0.5 px-2">
        {MAIN_TABS.map((t) => (
          <li key={t.id}>
            {t.status === "disabled" ? (
              <NotInClone><Icon d={t.icon} /><span className="leading-tight">{t.label}<Chip>Not in clone</Chip></span></NotInClone>
            ) : (
              <Link href={`/developer?tab=${t.id}`} onClick={() => setOpen(false)} aria-current={tab === t.id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[6px] px-3 py-2.5 text-[14px] transition-colors ${tab === t.id ? "bg-accent text-foreground" : "text-muted hover:bg-accent/60 hover:text-foreground"}`}>
                <Icon d={t.icon} />
                <span className="leading-tight">{t.label}{"beta" in t && t.beta && <Chip>Beta</Chip>}{t.status === "bridge" && <Chip>Demo</Chip>}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 px-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Learn</p>
      <ul className="mt-2 space-y-0.5 px-2">
        {LEARN.map((l) => (
          <li key={l.label}><Link href={l.href} className="flex items-center justify-between rounded-[6px] px-3 py-1.5 text-[13px] text-muted hover:bg-accent/60 hover:text-foreground">{l.label}<span aria-hidden className="text-[11px]">↗</span></Link></li>
        ))}
      </ul>
        </>
      )}
      <div className="mt-auto space-y-1 px-2 pb-4">
        <NotInClone className="!py-2"><Icon d={SETTINGS_TAB.icon} /><span className="leading-tight">Settings<Chip>Not in clone</Chip></span></NotInClone>
        <div className="px-3 py-2">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-medium uppercase text-muted ring-1 ring-border">{(session?.email ?? "local").slice(0, 2)}</span>
            <span className="min-w-0 leading-tight"><span className="block truncate text-[14px] font-medium">{session ? "Signed in (mock)" : "Local User"}</span><span className="block truncate text-[12px] text-muted" title={session?.email}>{session?.email ?? "local@example.test"}</span></span>
          </div>
          {session
            ? <button type="button" onClick={() => { clearMockSession(); router.push("/auth/login"); }} className="mt-2 inline-flex min-h-8 items-center rounded-[6px] px-2 text-[13px] text-primary hover:bg-accent">Sign out (mock)</button>
            : <Link href="/auth/login" className="mt-2 inline-flex min-h-8 items-center rounded-[6px] px-2 text-[13px] text-primary hover:bg-accent">Sign in (mock)</Link>}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="console min-h-screen">
      <div className="flex">
        {/* desktop sidebar */}
        {!collapsed && <aside className="sticky top-0 hidden h-screen w-[200px] shrink-0 border-r border-border md:block">{nav}</aside>}
        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-[110] md:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
            <aside ref={drawer} tabIndex={-1} data-lenis-prevent role="dialog" aria-modal="true" aria-label="Developer console menu" className="relative h-full w-[min(260px,85vw)] overflow-y-auto bg-background shadow-lg outline-none">{nav}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-8">
            <button ref={menuBtn} type="button" aria-label={collapsed ? "Show sidebar" : "Open menu"} aria-expanded={open} onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setCollapsed((c) => !c) : setOpen(true))} className="rounded-[4px] p-2 text-muted hover:bg-accent"><Icon d="M4 7h16M4 12h16M4 17h16" /></button>
            <div className="flex items-center rounded-full bg-accent py-1 pl-1 pr-3 text-[14px]">
              <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Product</span>
              {variant === "workspace"
                ? <><span aria-hidden className="ml-2 text-muted"><Icon d={BOOKS_ICON} size={14} /></span><span className="ml-1.5">Workspace</span></>
                : <><span className="ml-2 font-mono text-[12px] text-muted">&lt;/&gt;</span><span className="ml-1.5">Data &amp; API</span></>}<span aria-hidden className="ml-1.5 text-[10px] text-muted">▾</span>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[14px]" title="Jurisdiction: United States"><span aria-hidden>🇺🇸</span><span className="sr-only">United States</span><span aria-hidden className="text-[10px] text-muted">▾</span></span>
            <span className="ml-auto rounded-[2px] border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">Local mock</span>
          </header>
          <main id="main" tabIndex={-1} className="outline-none px-4 pb-24 pt-2 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
