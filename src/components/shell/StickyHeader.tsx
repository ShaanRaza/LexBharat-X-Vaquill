"use client";
import { useEffect, useRef } from "react";

// The sticky header (top bar and, on a desktop, the testing banner). It measures its own height and publishes it as --header-h, so everything else that sticks or scrolls into view under it (contents columns,
// anchors, keyboard focus) leaves exactly that much room, whatever the banner's height is (src/styles/tokens.css, tailwind `top-header`).
export default function StickyHeader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const set = () => document.documentElement.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    set(); const ro = new ResizeObserver(set); ro.observe(el); window.addEventListener("resize", set);
    return () => { ro.disconnect(); window.removeEventListener("resize", set); };
  }, []);
  return <div ref={ref} className="sticky top-0 z-30 bg-background">{children}</div>;
}
