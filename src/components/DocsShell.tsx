"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { guideNav, integrationsNav, referenceNav, indiaNav, allDocPages, INDIA_REF } from "@/data/docs/nav";
import { Wordmark } from "./Nav";
import { DocsGroupIcon } from "./docs/DocsIcons";
import DevOnly from "@/components/DevOnly";

// Docs chrome, laid out from measurements of the public docs page at 1440 px wide (see docs/DOCS-SHELL.md):
//   announcement bar 40 px (#5a2d27)  ·  header row 64 px  ·  tab row 48 px with 48 px side padding  ·  = 152 px sticky header
//   left sidebar 288 px (256 px of content, 32 px right padding), starting 32 px from the edge; main column from x = 320;
//   article column starts 43 px in and is at most 689 px wide; right "On this page" rail 264 px; page padding 32 px.

const tabs = [
  { id: "guide", label: "Data API Guide", href: "/docs/api-guide/coverage" },
  { id: "reference", label: "Data API Reference", href: "/docs/api-reference" },
  { id: "integrations", label: "Integrations", href: "/docs/integrations" },
  { id: "india", label: "India API Reference", href: `/docs/${INDIA_REF}` },
] as const;
const tabFor = (path: string): (typeof tabs)[number]["id"] =>
  path.includes("/india-pricing") ? "india" : path.startsWith("/docs/api-reference") ? "reference" : path.startsWith("/docs/integrations") ? "integrations" : "guide";
const navFor = { guide: guideNav, reference: referenceNav, integrations: integrationsNav, india: indiaNav };

const ANNOUNCE = "New: DOJ Justice Manual, USCIS Policy Manual, USPTO MPEP/TMEP, and DFARS PGI are now in the API.";

export default function DocsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [banner, setBanner] = useState(true);
  const [hh, setHh] = useState(152);
  const [dt, setDt] = useState(152); // where the mobile drawer starts: the header's real bottom edge (differs from hh while a dev banner sits above it)
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const tab = tabFor(path);
  const sections = navFor[tab];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => setMenu(false), [path]);
  useEffect(() => { try { if (sessionStorage.getItem("lb_docs_banner") === "0") setBanner(false); } catch { /* storage blocked: banner stays */ } }, []);

  // Header height drives every sticky offset (sidebar, right rail, drawer), so the layout stays right when the banner is dismissed or wraps.
  useEffect(() => {
    const el = headerRef.current; if (!el) return;
    const set = () => { const v = Math.round(el.getBoundingClientRect().height); setHh(v); document.documentElement.style.setProperty("--docs-hh", `${v}px`); };
    set(); const ro = new ResizeObserver(set); ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--docs-hh"); };
  }, [banner]);

  // Keep the active item in view inside the sidebar's own scroll area.
  useEffect(() => { asideRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" }); }, [path]);

  useEffect(() => {
    if (!menu) return;
    setDt(Math.max(0, Math.round(headerRef.current?.getBoundingClientRect().bottom ?? hh)));
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", esc); };
  }, [menu]);

  const hits = useMemo(() => q.trim() ? allDocPages.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [], [q]);

  return (
    <div className="min-h-screen bg-background">
      <DevOnly>
        <div className="bg-warning px-4 py-1.5 text-center text-[12px] font-medium text-white">LexBharat local build · docs are partly placeholder · all backend behavior is MOCKED</div>
      </DevOnly>
      <header ref={headerRef} className="sticky top-0 z-30 bg-background shadow-[inset_0_-1px_0_rgb(var(--border-rgb)/0.6)]">
        {banner && (
          <div className="relative flex min-h-10 items-center justify-center bg-[#5a2d27] px-12 py-2 text-center text-[14px] font-medium leading-5 text-white/95">
            <p>{ANNOUNCE} <Link href="/docs/api-guide/coverage" className="underline underline-offset-2">See what&apos;s covered.</Link></p>
            <button type="button" aria-label="Dismiss announcement" onClick={() => { setBanner(false); try { sessionStorage.setItem("lb_docs_banner", "0"); } catch { /* ignore */ } }}
              className="absolute right-4 top-1/2 grid size-[26px] -translate-y-1/2 place-items-center rounded-md hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        )}
        <div className="mx-auto grid h-16 max-w-[1440px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 lg:grid-cols-[1fr_minmax(0,437px)_1fr] lg:px-12">
          <div className="flex items-center gap-2">
            <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center lg:hidden" aria-label="Toggle docs menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <Wordmark />
          </div>
          <div className="relative w-full">
            <label htmlFor="docs-search" className="sr-only">Search docs</label>
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#65625f]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input id="docs-search" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs, guides, and the API reference..." autoComplete="off"
              className="h-9 w-full rounded-xl bg-[#f4f1ec] pl-9 pr-12 text-[14px] text-foreground outline-none ring-1 ring-border/60 placeholder:text-[#65625f] focus:ring-2 focus:ring-primary/50" />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md bg-surface px-1.5 py-0.5 font-sans text-[12px] text-[#65625f] ring-1 ring-border/70 sm:block">⌘K</kbd>
            {hits.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-border bg-surface p-1 shadow-lg">
                {hits.map((h) => <li key={h.slug}><Link href={`/docs/${h.slug}`} onClick={() => setQ("")} className="block rounded-lg px-3 py-2 text-[14px] hover:bg-raised">{h.title}</Link></li>)}
              </ul>
            )}
          </div>
          <div className="hidden items-center justify-end gap-6 lg:flex">
            <Link href="/open-us-law" className="flex min-h-9 items-center gap-1.5 whitespace-nowrap text-[14px] font-medium text-[#535151] hover:text-foreground">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.800 1a9.600 9.600 0 0 1 5 0c2-1.300 2.800-1 2.800-1 .5 1.400.2 2.400.1 2.700.6.7 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.3.7.9.7 1.900v2.800c0 .3.2.6.7.5A10 10 0 0 0 12 2z" /></svg>Open US Law Dataset</Link>
            <Link href="/support" className="flex min-h-9 items-center whitespace-nowrap text-[14px] font-medium text-[#535151] hover:text-foreground">Support</Link>
            <Link href="/developer?tab=overview" className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-xl bg-primary pl-3 pr-2 text-[14px] font-medium text-white hover:bg-primary-hover">Dashboard<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9" /></svg></Link>
          </div>
        </div>
        <nav className="mx-auto flex h-11 max-w-[1440px] gap-6 overflow-x-auto px-4 text-[14px] font-medium [scrollbar-width:none] lg:h-12 lg:px-12 [&::-webkit-scrollbar]:hidden" aria-label="Docs sections">
          {tabs.map((t) => {
            const on = tab === t.id;
            return (
              <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined} className={`relative flex h-full shrink-0 items-center whitespace-nowrap ${on ? "text-[#282726]" : "text-[#535151] hover:text-foreground"}`}>
                {t.label}
                {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[1.5px] bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1440px] px-4 lg:px-8">
        <aside ref={asideRef} data-lenis-prevent aria-label="Docs navigation"
          style={{ "--dt": `${dt}px`, "--hh": `${hh}px` } as React.CSSProperties}
          className={`${menu ? "block" : "hidden"} fixed inset-x-0 bottom-0 top-[var(--dt)] z-20 overflow-y-auto lg:top-[var(--hh)] lg:h-[calc(100vh-var(--hh))] bg-background px-4 pb-10 pt-6 lg:sticky lg:inset-x-auto lg:bottom-auto lg:block lg:w-72 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:bg-transparent lg:pb-10 lg:pl-0 lg:pr-8 lg:pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          <nav aria-label="Pages" className="text-[14px] leading-6">
            {sections.map((s, i) => (
              <div key={s.title} className={i === 0 ? "" : "mt-6 lg:mt-8"}>
                {s.icon ? (
                  <h3 className="mb-3.5 flex items-center gap-2.5 pl-4 text-[14px] font-semibold uppercase leading-6 text-[#1a1818] lg:mb-2.5">
                    <DocsGroupIcon name={s.icon} /><span>{s.title}</span>
                  </h3>
                ) : (
                  <h3 className="mb-3.5 pl-4 text-[14px] font-semibold uppercase leading-6 text-[#1a1818] lg:mb-2.5">{s.title}</h3>
                )}
                <ul className="space-y-px">
                  {s.pages.map((p) => {
                    const href = `/docs/${p.slug}`;
                    const active = path === href;
                    return (
                      <li key={p.slug}>
                        <Link href={href} aria-current={active ? "page" : undefined}
                          className={`group flex w-full items-start rounded-xl py-1.5 pl-4 pr-3 text-left outline-offset-[-1px] ${active ? "bg-primary/10 text-primary [text-shadow:-0.2px_0_0_currentColor,0.2px_0_0_currentColor]" : "text-[#414040] hover:bg-[#4b5563]/5"}`}>
                          <span className="min-w-0 max-w-full break-words [hyphens:auto]">{p.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 py-8 outline-none lg:pl-[43px] lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
