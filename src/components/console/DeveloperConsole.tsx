"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ConsoleShell, { CONSOLE_TABS, type TabId } from "./ConsoleShell";
import PlaygroundApp from "./PlaygroundApp";
import { useMockKey } from "@/lib/useMockKey";

const card = "rounded-[8px] border border-border bg-surface p-5";
const btn = "inline-flex h-9 items-center justify-center rounded-[4px] bg-primary px-4 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover";

// Overview and API Keys are INFERRED, minimal screens (the teardown only observed the Overview's credit card, API key card and usage card
// at a glance). The balance is a fixed mock figure. Every other tab is an honest placeholder.
function Overview() {
  const { key, create } = useMockKey();
  return (
    <div className="max-w-[880px] space-y-4">
      <h1 className="pt-2 text-[21px] font-semibold">Overview</h1>
      <section className={card}>
        <p className="text-[12px] text-muted">Credit balance</p>
        <p className="mt-1 text-[34px] font-semibold leading-none">1,000 <span className="text-[14px] font-normal text-muted">credits</span></p>
        <p className="mt-2 text-[14px]">On <strong className="font-medium">Pay as you go</strong> (mock)</p>
      </section>
      <section className={card}>
        <div className="flex items-center justify-between"><h2 className="text-[17px]">API key</h2><Link href="/developer?tab=api-key" className="text-[13px] text-primary">Manage ↗</Link></div>
        <p className="mt-3 text-[14px] text-muted">{key ? "A mock key is stored in this browser." : "No active key yet. Create one to start making requests."}</p>
        {!key && <button type="button" onClick={create} className={`${btn} mt-4`}>Create a key</button>}
      </section>
      <section className={card}>
        <h2 className="text-[17px]">Get started</h2>
        <Link href="/developer?tab=playground" className="mt-3 block rounded-[6px] p-2 hover:bg-accent"><span className="font-medium">Playground</span><span className="block text-[13px] text-muted">Run a live request and copy the code for it.</span></Link>
      </section>
    </div>
  );
}

function ApiKeys() {
  const { key, create, clear } = useMockKey();
  return (
    <div className="max-w-[880px] space-y-4">
      <h1 className="pt-2 text-[21px] font-semibold">API Keys</h1>
      <section className={card}>
        {key ? (
          <>
            <p className="text-[14px]">Mock key (stored in this browser only; it unlocks nothing real):</p>
            <p className="mt-2 break-all rounded-[4px] bg-accent px-3 py-2 font-mono text-[12px]">{key.slice(0, 12)}…{key.slice(-4)}</p>
            <button type="button" onClick={clear} className="mt-4 h-9 rounded-[4px] border border-border px-4 text-[14px] hover:bg-accent">Delete mock key</button>
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted">No active key yet. Create one to start making requests.</p>
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
          <div className="max-w-[880px] space-y-3 pt-2">
            <h1 className="text-[21px] font-semibold">{label}</h1>
            <section className={card}>
              <p className="text-[14px]">{tab === "law-changes" ? "The console version of Law Change Alerts is not recreated here. This project does have a separate local demo of alerts (create, list and delete watches against an in-memory mock)." : "The console version of the MCP Server page is not recreated here. This project has a separate local MCP overview page."}</p>
              <Link href={tab === "law-changes" ? "/alerts" : "/mcp"} className={`${btn} mt-4`}>{tab === "law-changes" ? "Open the Alerts demo" : "Open the MCP page"}</Link>
              <p className="mt-3 text-[12px] text-muted">Opens a local marketing-site page outside the console.</p>
            </section>
          </div>
        ) : (
          <div className="max-w-[880px] space-y-3 pt-2">
            <h1 className="text-[21px] font-semibold">{label}</h1>
            <section className={card} role="note">
              <p className="text-[14px]"><strong className="font-medium">{label} is not part of this clone, on purpose.</strong> {tab === "settings" ? "There are no account settings to change in a local mock." : "This local mock never touches credits, billing or real API keys."}</p>
              <Link href="/developer?tab=playground" className={`${btn} mt-4`}>Back to the Playground</Link>
            </section>
          </div>
        )}
    </ConsoleShell>
  );
}
