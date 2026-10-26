"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "./TopBar";
import LogoutLink from "@/components/LogoutLink";
import { Badge, Logo } from "@/components/kit";
import { buttonClass } from "@/components/kit/controls";
import WorkspaceNav, { type LawTab } from "@/components/workspace/WorkspaceNav";
import { clearMockSession, useMockSession } from "@/lib/mockSession";

// Layout of the authenticated developer console as captured in docs/PLAYGROUND-TEARDOWN.md: collapsible left sidebar, top bar with a
// hamburger, product switcher and country selector. ONE shell for every page: the developer console (variant "data") and the Acts & Judgments
// browser (variant "workspace") share the same sidebar and top bar; the variant only picks the highlighted item and the console-only badges. Sidebar width, icons and the mobile drawer are INFERRED
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
    <span role="link" aria-disabled="true" title="Not part of this local clone" className={`flex cursor-not-allowed items-center gap-3 rounded-button px-3 py-2.5 text-fs-ui text-muted/60 ${className}`}>{children}</span>
  );
}
const Chip = ({ children }: { children: React.ReactNode }) => <Badge className="ml-1.5 whitespace-nowrap align-middle !px-1.5 text-fs-micro">{children}</Badge>;

const LEARN = [
  { label: "API Docs", href: "/docs" },
  { label: "Coverage", href: "/workspace/browse" },
  { label: "MCP Guide", href: "/mcp" },
  { label: "Open dataset", href: "https://huggingface.co/datasets/vaquill/open-india-law" },
];

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const BOOKS_ICON = "M5 4h4v16H5zM10 4h4v16h-4zM15.6 5.4l3.6-1 3.2 14.6-3.6 1z";

export default function ConsoleShell({ tab, variant = "data", lawTab, children }: { tab?: TabId; variant?: "data" | "workspace" | "lawspace"; lawTab?: LawTab; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);       // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop collapse (chevron)
  const router = useRouter();
  const session = useMockSession(); // MOCK sign-in record from /auth/login (this browser only), or null
  const menuBtn = useRef<HTMLButtonElement>(null);
  // Acts & Judgments is one set of pages used by both products: remember which product you are in (read by BrowseShell on the server) so it shows the matching sidebar.
  useEffect(() => { document.cookie = `lb_product=${variant === "lawspace" ? "workspace" : "data"}; path=/; max-age=31536000; samesite=lax`; }, [variant]);
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

  const logoRowFor = (home: string) => (
    <div className="flex items-center justify-between px-4 pb-4 pt-5">
      <Logo href={home} compact={variant !== "lawspace"} className="min-w-0" />
      <button type="button" onClick={() => (open ? setOpen(false) : setCollapsed(true))} aria-label={open ? "Close menu" : "Collapse sidebar"} className="grid size-9 shrink-0 place-items-center rounded-button text-secondary hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
        <Icon d={open ? "M6 6l12 12M18 6L6 18" : "M15 5l-7 7 7 7"} size={16} />
      </button>
    </div>
  );
  const logoRow = logoRowFor("/developer?tab=overview");
  const dataNav = (
    <nav aria-label="Console" className="flex h-full flex-col">
      {logoRow}
      <ul className="space-y-0.5 px-2">
        {MAIN_TABS.map((t) => (
          <li key={t.id}>
            {t.status === "disabled" ? (
              <NotInClone><Icon d={t.icon} /><span className="leading-tight">{t.label}<Chip>Not in clone</Chip></span></NotInClone>
            ) : (
              <Link href={`/developer?tab=${t.id}`} onClick={() => setOpen(false)} aria-current={tab === t.id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-button px-3 py-2.5 text-fs-ui transition-colors ${tab === t.id ? "bg-primary/10 font-medium text-primary" : "text-secondary hover:bg-accent hover:text-foreground"}`}>
                <Icon d={t.icon} />
                <span className="leading-tight">{t.label}{"beta" in t && t.beta && <Chip>Beta</Chip>}{t.status === "bridge" && <Chip>Demo</Chip>}</span>
              </Link>
            )}
          </li>
        ))}
        {/* "Acts & Judgments" sits after MCP Server in the original's sidebar; highlighted on every page under /workspace/browse. */}
        <li>
          <Link href="/workspace/browse" onClick={() => setOpen(false)} aria-current={variant === "workspace" ? "page" : undefined}
            className={`flex items-center gap-3 rounded-button px-3 py-2.5 text-fs-ui transition-colors ${variant === "workspace" ? "bg-primary/10 font-medium text-primary" : "text-secondary hover:bg-accent hover:text-foreground"}`}>
            <Icon d={BOOKS_ICON} /><span className="leading-tight">Acts &amp; Judgments</span>
          </Link>
        </li>
      </ul>
      <p className="mt-6 px-5 font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted"><span aria-hidden className="mr-1">¶</span>Learn</p>
      <ul className="mt-2 space-y-0.5 px-2">
        {LEARN.map((l) => (
          <li key={l.label}><Link href={l.href} className="flex items-center justify-between rounded-button px-3 py-1.5 text-fs-sm text-secondary hover:bg-accent hover:text-foreground">{l.label}<span aria-hidden className="text-fs-nano">↗</span></Link></li>
        ))}
      </ul>
      <div className="mt-auto space-y-1 px-2 pb-4">
        <NotInClone className="!py-2"><Icon d={SETTINGS_TAB.icon} /><span className="leading-tight">Settings<Chip>Not in clone</Chip></span></NotInClone>
        <div className="px-3 py-2">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-fs-nano font-medium uppercase text-muted ring-1 ring-border">{(session?.email ?? "local").slice(0, 2)}</span>
            <span className="min-w-0 leading-tight"><span className="block truncate text-fs-ui font-medium">{session ? "Signed in" : "Not signed in"}</span><span className="block truncate text-fs-xs text-muted" title={session?.email}>{session?.email ?? "Demo console"}</span></span>
          </div>
          {session
            ? <button type="button" onClick={() => { clearMockSession(); router.push("/auth/login"); }} className="mt-2 inline-flex min-h-8 items-center rounded-button px-2 text-fs-sm text-primary hover:bg-accent">Sign out</button>
            : <Link href="/auth/login" className="mt-2 inline-flex min-h-8 items-center rounded-button px-2 text-fs-sm text-primary hover:bg-accent">Sign in (demo)</Link>}
          <div className="mt-1 px-2"><LogoutLink /></div>
        </div>
      </div>
    </nav>
  );

  // Legal Workspace sidebar (src/components/workspace/WorkspaceNav.tsx); the same component fills the phone menu.
  const lawNav = <WorkspaceNav active={lawTab} logo={logoRowFor("/workspace")} onNavigate={() => setOpen(false)} />;
  const nav = variant === "lawspace" ? lawNav : dataNav;

  return (
    <div className="console min-h-screen">
      <div className="flex">
        {/* desktop sidebar */}
        {!collapsed && <aside className={`sticky top-0 hidden h-screen shrink-0 border-r border-border md:block ${variant === "lawspace" ? "w-sidebar" : "w-sidebar-narrow"}`}>{nav}</aside>}
        {/* mobile drawer */}
        {open && (
          <div className="fixed inset-0 z-[110] md:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
            <aside ref={drawer} tabIndex={-1} data-lenis-prevent role="dialog" aria-modal="true" aria-label="Console menu" className="relative h-full w-drawer overflow-y-auto rounded-r-card bg-surface shadow-lg outline-none">{nav}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-8">
            <button ref={menuBtn} type="button" aria-label={collapsed ? "Show sidebar" : "Open menu"} aria-expanded={open} onClick={() => (window.matchMedia("(min-width: 768px)").matches ? setCollapsed((c) => !c) : setOpen(true))} className="rounded-tight p-2 text-muted hover:bg-accent"><Icon d="M4 7h16M4 12h16M4 17h16" /></button>
            <TopBar product={variant === "lawspace" ? "workspace" : "data"} />
            {variant === "data" && <Link href="/docs/api-guide/changelog" className="hidden min-h-8 items-center gap-1.5 rounded-full bg-accent/60 px-3 text-fs-sm text-secondary hover:text-foreground lg:inline-flex">Coverage is expanding fast. <strong className="font-semibold text-foreground">Changelog</strong><span aria-hidden>↗</span></Link>}
            {variant === "data" && <span className="rounded-control border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-mono text-fs-micro font-medium uppercase tracking-wider text-warning">Demo</span>}
          </header>
          <main id="main" tabIndex={-1} className="outline-none px-4 pb-24 pt-2 md:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
