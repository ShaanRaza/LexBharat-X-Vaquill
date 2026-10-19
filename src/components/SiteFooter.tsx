"use client";
import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "./Nav";
import MockBadge from "./MockBadge";
import { footerGroups } from "@/data/site";
import { RELEASE } from "@/lib/release";

function Newsletter() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const valid = /^\S+@\S+\.\S+$/.test(email);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/mock/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const j = await r.json();
    setMsg(j.message ?? j.error);
    if (j.ok) setEmail("");
  }
  return (
    <form onSubmit={submit} className="max-w-[420px]">
      <h3 className="text-[15px] font-semibold">API updates and coverage releases, monthly. <MockBadge>mock form</MockBadge></h3>
      <label htmlFor="email" className="sr-only">Email address</label>
      <div className="mt-3 flex gap-2">
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="min-w-0 flex-1 rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-[15px]" />
        <button disabled={!valid} className="btn btn-primary !px-4 !py-2 !text-[15px] disabled:opacity-40">Subscribe</button>
      </div>
      <p className="mt-2 min-h-5 text-[13px] text-muted" aria-live="polite">{msg}</p>
    </form>
  );
}

export default function SiteFooter() {
  return (
    <footer className="px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1152px] gap-10 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-muted">LexBharat: an open API for US primary law, with a source link on every section.{RELEASE ? "" : " (mock copy)"}</p>
          <p className="mt-3 text-[14px] text-primary">hello@lexbharat.example</p>
          <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
            <Link href="/slack" className="inline-flex min-h-6 items-center whitespace-nowrap hover:text-primary">Community</Link>
            <Link href="/word" className="inline-flex min-h-6 items-center whitespace-nowrap hover:text-primary">Word add-in</Link>
            <Link href="/for-lawyers" className="inline-flex min-h-6 items-center whitespace-nowrap hover:text-primary">For lawyers</Link>
            <Link href="/brand" className="inline-flex min-h-6 items-center whitespace-nowrap hover:text-primary">Brand</Link>
          </p>
        </div>
        {Object.entries(footerGroups).map(([h, items]) => (
          <div key={h}>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{h}</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {items.map((x) => <li key={x.label}><Link href={x.href} className="hover:text-primary">{x.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-[1152px] flex-wrap items-start justify-between gap-8 border-t border-border pt-8">
        <Newsletter />
        <p className="text-[13px] text-muted">{RELEASE ? "© LexBharat." : "LexBharat local build. Placeholder content, mocked backend. © LexBharat."}</p>
      </div>
    </footer>
  );
}
