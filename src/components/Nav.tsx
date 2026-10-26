"use client";
import Link from "next/link";
import { useState } from "react";
import { navLinks } from "@/data/site";
import { RELEASE } from "@/lib/release";

// Original placeholder mark; swap in the real LexBharat logo when available.
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LexBharat home">
      <svg width="28" height="34" viewBox="0 0 28 34" aria-hidden>
        <path d="M24 2C10 4 3 14 4 30c9-2 18-9 20-28Z" fill={light ? "rgb(var(--background-rgb))" : "var(--primary)"} />
        <path d="M5 30C9 21 14 14 21 8" stroke={light ? "rgb(var(--dark-rgb))" : "rgb(var(--background-rgb))"} strokeWidth="1.5" fill="none" />
      </svg>
      <span className={`text-fs-title font-medium tracking-tight ${light ? "text-background" : "text-foreground"}`}>
        LexBharat
      </span>
    </Link>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className={`absolute inset-x-0 z-30 mx-auto flex max-w-w1216 items-center justify-between px-4 sm:px-6 lg:px-8 ${RELEASE ? "top-5 sm:top-6" : "top-16 sm:top-9"}`} aria-label="Main">
      <Wordmark />
      <div className="hidden items-center gap-8 text-fs-17 md:flex">
        {navLinks.map((l) => (
          <Link key={l.label} href={l.href} className="transition-colors hover:text-primary">{l.label}</Link>
        ))}
        <Link href="/slack" aria-label="Community" className="inline-flex h-9 w-9 items-center justify-center text-muted hover:text-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v11H9l-5 4z" /></svg>
        </Link>
      </div>
      <div className="hidden items-center gap-5 md:flex">
        <Link href="/auth/login" className="text-fs-17 hover:text-primary">Sign in</Link>
        <Link href="/auth/signup" className="btn btn-primary !px-4 !py-2 !text-fs-body">Get API key</Link>
      </div>
      <button className="inline-flex h-10 w-10 shrink-0 items-center justify-center md:hidden" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <div className="absolute left-4 right-4 top-14 rounded-panel border border-border bg-surface p-4 shadow-lg md:hidden">
          {[...navLinks, { label: "Sign in", href: "/auth/login" }, { label: "Get API key", href: "/auth/signup" }].map((l) => (
            <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-fs-17">{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
