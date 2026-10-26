"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RELEASE } from "@/lib/release";

const phrases = ["your AI agents", "your legal AI", "your research platform", "your compliance tools"];

function CyclingHeadline() {
  const [i, setI] = useState(2); // start on a middle phrase, like the public capture did
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % phrases.length), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <h1 className="text-fs-44 font-semibold leading-display-tight tracking-brand sm:text-fs-64 lg:text-fs-72">
      <span className="sr-only">US laws for your AI agents, your legal AI, your research platform and your compliance tools.</span>
      <span aria-hidden className="block">
        <span className="block">US laws for</span>
        {/* Phones: the phrase is an inline span so its highlight wraps line by line. sm and up: the original one-box highlight. */}
        <span className="relative text-primary sm:inline-block">
          <span className="absolute inset-x-[-10px] bottom-1 top-[18%] -z-10 hidden rounded-sm bg-primary/15 sm:block" />
          <span key={i} className="animate-[rise_.6s_cubic-bezier(.16,1,.3,1)] rounded-sm bg-primary/15 px-1 [box-decoration-break:clone] [-webkit-box-decoration-break:clone] sm:inline-block sm:bg-transparent sm:px-0">{phrases[i]}</span>
        </span>
      </span>
      <style>{`@keyframes rise{from{opacity:0;transform:translateY(.35em)}to{opacity:1;transform:none}}`}</style>
    </h1>
  );
}

const stats = [
  { v: "5.4M+", l: "primary-law sections", n: 1 },
  { v: "56", l: "US jurisdictions", n: 2 },
  { v: "3", l: "access paths: REST, MCP and SQL" },
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-16 pt-40 sm:px-6 sm:pt-44 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[900px] w-[900px] rounded-full border border-foreground/5" />
      <div className="relative mx-auto max-w-w1216">
        <div className="max-w-w860 lg:pl-8">
          <CyclingHeadline />
          <p className="mt-7 max-w-w640 text-fs-xl leading-relaxed text-muted">
            <strong className="font-medium text-foreground">LexBharat</strong> is an open API for US primary law{RELEASE ? "" : " (mock copy)"}:
            statutes, regulations, court rules and agency guidance, with source links.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/auth/signup" className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M16 7l3 3" /></svg>
              Get API key <span aria-hidden>→</span>
            </Link>
            <Link href="/contact" className="btn btn-secondary !px-6">
              Book a demo
              <span className="-space-x-2 flex">
                <span className="h-6 w-6 rounded-full border-2 border-raised bg-primary/50" />
                <span className="h-6 w-6 rounded-full border-2 border-raised bg-foreground/60" />
              </span>
            </Link>
          </div>
          <p className="mt-4 text-fs-body text-muted">Free credits for personal projects, student work, and academic research.</p>
          <dl className="mt-10 flex max-w-w824 flex-wrap gap-x-12 gap-y-6 border-t border-foreground/15 pt-8">
            {stats.map((s) => (
              <div key={s.l}>
                <dt className="flex items-center gap-2 text-fs-34 font-medium leading-none tracking-tight text-primary">
                  {s.v}
                  {s.n && <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-primary/15 text-fs-micro font-semibold">{s.n}</span>}
                </dt>
                <dd className="mt-2 text-fs-ui text-muted">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Link href="/claude-plugin"
          className="mt-10 flex w-fit items-center gap-3 rounded-panel border border-border bg-surface px-4 py-3 text-fs-body lg:absolute lg:right-8 lg:top-[250px] lg:mt-0 lg:w-[272px] lg:justify-between">
          <span className="flex items-center gap-3"><span className="text-primary">✳</span>Available in an AI assistant</span> <span>→</span>
        </Link>
      </div>
    </section>
  );
}
