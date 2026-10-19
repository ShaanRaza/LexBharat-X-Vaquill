"use client";
import { useEffect, useState } from "react";

export type TocItem = { id: string; label: string; level: 2 | 3 };

/** Right-hand "On this page" rail: 264 px wide, sticky below the header, the heading currently in view is highlighted. */
export default function DocsToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const onScroll = () => {
      const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--docs-hh")) || 152;
      let cur = els[0].id;
      for (const e of els) { if (e.getBoundingClientRect().top - hh - 24 <= 0) cur = e.id; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = els[els.length - 1].id;
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [items]);
  return (
    <aside className="hidden w-[264px] shrink-0 xl:block" aria-label="On this page">
      <nav className="sticky top-[calc(var(--docs-hh,152px)+40px)] max-h-[calc(100vh-var(--docs-hh,152px)-64px)] overflow-y-auto text-[14px] leading-6 text-[#535151]" data-lenis-prevent>
        <h2 className="m-0 flex items-center gap-2 font-normal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h14" /></svg>On this page
        </h2>
        <ul className="mt-2 border-l border-border">
          {items.map((i) => (
            <li key={i.id}>
              <a href={`#${i.id}`} aria-current={active === i.id ? "location" : undefined}
                className={`-ml-px block break-words border-l py-1 font-medium transition-colors ${i.level === 3 ? "pl-7" : "pl-4"} ${active === i.id ? "border-primary text-primary" : "border-transparent text-[#535151] hover:text-foreground"}`}>{i.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
