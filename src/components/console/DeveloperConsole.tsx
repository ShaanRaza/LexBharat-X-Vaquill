"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ConsoleShell, { CONSOLE_TABS, type TabId } from "./ConsoleShell";
import PlaygroundApp from "./PlaygroundApp";
import { useMockKey } from "@/lib/useMockKey";

const card = "rounded-field border border-border bg-surface p-5";
const btn = "inline-flex h-9 items-center justify-center rounded-tight bg-primary px-4 text-fs-ui font-medium text-white transition-colors hover:bg-primary-hover";

// Overview layout recreated from a screenshot of the original Overview page: credit card, privacy band, API key and Usage cards, Get started list,
// "Free for non-commercial use" card. Figures are fixed mock values; the key shown is the MOCK key (prefix only); Buy credits, View all and the
// walkthrough are not recreated (billing and credits are intentionally out of scope).
const I = ({ d }: { d: string }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const START = [
  { href: "/developer?tab=playground", title: "Playground", text: "Run a live request and copy the code for it.", icon: "M6 4l14 8-14 8z" },
  { href: "/developer?tab=mcp", title: "MCP Server", text: "Use the corpus from Claude, Cursor, or VS Code.", icon: "M14 4l6 6M4 20l8-8M10 6l8 8" },
  { href: "/developer?tab=law-changes", title: "Law Change Alerts", text: "Get notified when a law you rely on changes.", icon: "M4 6h12M4 12h8M4 18h12M19 8v8" },
];

function Overview() {
  const { key, create } = useMockKey();
  const [copied, setCopied] = useState(false);
  const prefix = key ? `${key.slice(0, 16)}-` : "";
  return (
    <div className="mx-auto max-w-content pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-fs-26 font-semibold tracking-tight">Overview<span title="Demo: the sample API data, key and credits here are simulated, and the sample data is US law. The real Indian Acts and judgments are under Acts & Judgments." className="text-subtle"><I d="M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" /></span></h1>
        <Link href="/docs" className="inline-flex min-h-8 items-center gap-1.5 text-fs-sm text-subtle hover:text-foreground"><I d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />Docs</Link>
      </div>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
        <div>
          <p className="text-fs-sm text-secondary">Credit balance</p>
          <p className="mt-1 text-fs-44 font-semibold leading-none tracking-tight">1,000 <span className="text-fs-lead font-normal text-secondary">credits</span></p>
          <p className="mt-3 text-fs-ui">On <strong className="font-medium">Pay as you go</strong> <span className="text-subtle">(mock)</span></p>
          <p className="mt-1 text-fs-ui text-secondary">No usage recorded in the last 30 days.</p>
        </div>
        <button type="button" disabled title="Not part of this clone: billing and credits are not recreated" className="inline-flex h-11 items-center gap-2 rounded-button bg-primary px-5 text-fs-body font-medium text-white opacity-50"><I d="M6 6h15l-2 9H8zM6 6L5 3H2M9 20h.01M18 20h.01" />Buy credits</button>
      </section>

      <section className="mt-4 rounded-card bg-legacy-ebe7e0/70 p-4 ring-1 ring-border/50">
        <div className="flex items-start justify-between gap-3"><p className="flex items-center gap-2 text-fs-body font-medium"><span aria-hidden className="text-primary"><I d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z" /></span>The API does not store your query text.</p>
          <Link href="/security" className="inline-flex min-h-8 shrink-0 items-center text-fs-sm text-secondary hover:text-foreground">See exactly what is stored</Link></div>
        <p className="mt-1.5 pl-7 text-fs-sm text-secondary">Requests exist in memory for the length of the call. We keep per-day call counts for billing, not what you searched for.</p>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
          <div className="flex items-center justify-between"><h2 className="text-fs-20">API key</h2><Link href="/developer?tab=api-key" className="inline-flex min-h-8 items-center text-fs-sm text-primary hover:underline">Manage ↗</Link></div>
          {key ? (
            <>
              <div className="mt-3 flex items-center gap-2 rounded-field bg-accent px-3 py-2.5"><code className="min-w-0 flex-1 truncate font-mono text-fs-sm">{prefix}</code>
                <button type="button" aria-label={copied ? "Copied" : "Copy key prefix"} onClick={() => { navigator.clipboard?.writeText(prefix).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="grid size-8 place-items-center rounded-md text-secondary hover:bg-surface"><I d={copied ? "M5 12.500l4.500 4.500L19 7.500" : "M9 9h11v11H9zM5 15V5a1 1 0 0 1 1-1h10"} /></button></div>
              <p className="mt-3 text-fs-sm text-secondary">Only the prefix is shown here. This is a mock key kept in this browser; manage it in the API Keys tab.</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-fs-ui text-secondary">No active key yet. Create one to start making requests.</p>
              <button type="button" onClick={create} className={`${btn} mt-4`}>Create a key</button>
            </>
          )}
        </section>
        <section className="rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
          <div className="flex items-center justify-between"><h2 className="text-fs-20">Usage</h2><span title="Not part of this clone" className="text-fs-sm text-subtle">View all ↗</span></div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div><p className="text-fs-sm text-secondary">Credits used, all time</p><p className="mt-1 text-fs-title font-medium leading-none">0</p></div>
            <div><p className="text-fs-sm text-secondary">Requests on this key</p><p className="mt-1 text-fs-title font-medium leading-none">0</p></div>
          </div>
          <p className="mt-4 text-fs-sm text-secondary">Daily breakdown and transaction history live in Credits &amp; Usage (not recreated).</p>
        </section>
      </div>

      <section className="mt-7" aria-labelledby="gs">
        <div className="flex items-center justify-between"><h2 id="gs" className="text-fs-22">Get started</h2><Link href="/docs/api-guide/quickstart" className="inline-flex min-h-8 items-center gap-1.5 text-fs-ui text-secondary hover:text-foreground"><I d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />Quickstart</Link></div>
        <ul className="mt-2">
          {START.map((g) => (
            <li key={g.title}><Link href={g.href} className="group flex items-center gap-4 rounded-lg px-1 py-3 hover:bg-accent/60">
              <span className="text-primary"><I d={g.icon} /></span>
              <span className="min-w-0 flex-1"><span className="block text-fs-body font-medium">{g.title}</span><span className="block text-fs-ui text-secondary">{g.text}</span></span>
              <span aria-hidden className="text-secondary transition-transform group-hover:translate-x-0.5">↗</span></Link></li>
          ))}
        </ul>
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-5 shadow-sm ring-1 ring-border/60">
        <div className="max-w-w560"><h2 className="text-fs-22">Free for non-commercial use</h2>
          <p className="mt-2 text-fs-ui leading-relaxed text-secondary">API access is free for personal use, legal aid, and other non-commercial work. Write to us with who you are, your LinkedIn profile, and what you are building, and we will grant you enough credits to cover the year.</p></div>
        <Link href="/contact" className="inline-flex h-10 items-center gap-2 rounded-button px-4 text-fs-ui ring-1 ring-control-border hover:bg-accent"><I d="M4 6h16v12H4zM4 7l8 6 8-6" />Email us</Link>
      </section>
      <p className="mt-4 text-fs-xs text-subtle">Mock page: every figure is fixed, nothing here is tied to a real account, key or balance.</p>
    </div>
  );
}

function ApiKeys() {
  const { key, create, clear } = useMockKey();
  return (
    <div className="max-w-content space-y-4">
      <h1 className="pt-2 text-fs-21 font-semibold">API Keys</h1>
      <section className={card}>
        {key ? (
          <>
            <p className="text-fs-ui">Mock key (stored in this browser only; it unlocks nothing real):</p>
            <p className="mt-2 break-all rounded-tight bg-accent px-3 py-2 font-mono text-fs-xs">{key.slice(0, 12)}…{key.slice(-4)}</p>
            <button type="button" onClick={clear} className="mt-4 h-9 rounded-tight border border-border px-4 text-fs-ui hover:bg-accent">Delete mock key</button>
          </>
        ) : (
          <>
            <p className="text-fs-ui text-muted">No active key yet. Create one to start making requests.</p>
            <button type="button" onClick={create} className={`${btn} mt-4`}>Create API key</button>
          </>
        )}
      </section>
    </div>
  );
}

export default function DeveloperConsole() {
  const sp = useSearchParams();
  const raw = sp.get("tab") ?? "overview";
  const tab = (CONSOLE_TABS.some((t) => t.id === raw) ? raw : "overview") as TabId; // unknown values fall back to Overview
  const def = CONSOLE_TABS.find((t) => t.id === tab)!;
  const label = def.label;
  return (
    <ConsoleShell tab={tab}>
      {tab === "playground" ? <PlaygroundApp initialEndpoint={sp.get("endpoint")} />
        : tab === "overview" ? <Overview />
        : tab === "api-key" ? <ApiKeys />
        : def.status === "bridge" ? (
          <div className="max-w-content space-y-3 pt-2">
            <h1 className="text-fs-21 font-semibold">{label}</h1>
            <section className={card}>
              <p className="text-fs-ui">{tab === "law-changes" ? "The console version of Law Change Alerts is not recreated here. This project does have a separate local demo of alerts (create, list and delete watches against an in-memory mock)." : "The console version of the MCP Server page is not recreated here. This project has a separate local MCP overview page."}</p>
              <Link href={tab === "law-changes" ? "/alerts" : "/mcp"} className={`${btn} mt-4`}>{tab === "law-changes" ? "Open the Alerts demo" : "Open the MCP page"}</Link>
              <p className="mt-3 text-fs-xs text-muted">Opens a local marketing-site page outside the console.</p>
            </section>
          </div>
        ) : (
          <div className="max-w-content space-y-3 pt-2">
            <h1 className="text-fs-21 font-semibold">{label}</h1>
            <section className={card} role="note">
              <p className="text-fs-ui"><strong className="font-medium">{label} is not part of this clone, on purpose.</strong> {tab === "settings" ? "There are no account settings to change in a local mock." : "This local mock never touches credits, billing or real API keys."}</p>
              <Link href="/developer?tab=playground" className={`${btn} mt-4`}>Back to the Playground</Link>
            </section>
          </div>
        )}
    </ConsoleShell>
  );
}
