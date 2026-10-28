"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AREAS, areaOf, isReadingPage } from "@/lib/shell/areas.mjs";
import { Icon } from "./icons";

// The phone's bottom tab bar: the same five areas, as icons with labels. On reading pages (a law, a judgment) it slides away while you scroll down and returns when you scroll up, so the text has the screen.
// Presentation only (the scroll listener only decides hidden or shown).
export default function TabBar() {
  const pathname = usePathname(), area = areaOf(pathname), reading = isReadingPage(pathname), [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false); if (!reading) return;
    let last = window.scrollY;
    const on = () => { const y = window.scrollY, d = y - last; if (Math.abs(d) < 8) return; setHidden(d > 0 && y > 80); last = y; };
    window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on);
  }, [reading, pathname]);
  return (
    <nav aria-label="Areas" className={`fixed inset-x-0 bottom-0 z-30 grid h-tabbar grid-cols-5 border-t border-border bg-surface transition-transform duration-200 motion-reduce:transition-none md:hidden ${hidden ? "translate-y-full" : ""}`}>
      {AREAS.map((a) => (
        <Link key={a.id} href={a.href} aria-current={area === a.id ? "page" : undefined} tabIndex={hidden ? -1 : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 text-ui-xs focus-visible:outline-2 focus-visible:outline-primary ${area === a.id ? "font-medium text-primary" : "text-muted"}`}>
          <Icon name={a.id} className="size-6" />{a.label}
        </Link>
      ))}
    </nav>
  );
}
