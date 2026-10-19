"use client";
import { useEffect, useRef } from "react";

/**
 * Scroll-in animation as progressive enhancement. Content is VISIBLE by default (server HTML, no JS, print,
 * reduced motion). After hydration only blocks that start below the fold are hidden, and they are revealed by
 * BOTH an IntersectionObserver and a scroll/resize position check, so a missing or throttled observer can never
 * leave content permanently invisible.
 */
export default function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const maybe = ref.current;
    if (!maybe) return;
    const el: HTMLDivElement = maybe;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already in view: leave visible
    el.classList.add("reveal-hidden");
    let io: IntersectionObserver | undefined;
    const stop = () => {
      io?.disconnect();
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
    const show = () => { el.classList.add("in"); stop(); };
    function check() { if (el.getBoundingClientRect().top < window.innerHeight * 0.92) show(); }
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(([e]) => { if (e.isIntersecting) show(); }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
      io.observe(el);
    }
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    check();
    return stop;
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}
