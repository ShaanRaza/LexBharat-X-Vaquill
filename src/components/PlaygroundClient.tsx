"use client";
import { useMemo, useState } from "react";
import { endpoints } from "@/data/endpoints";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

const paramsFor = (path: string): { name: string; placeholder: string }[] => {
  if (path.endsWith("/resolve")) return [{ name: "cite", placeholder: "42 U.S.C. § 1983" }];
  if (path.endsWith("/search")) return [{ name: "query", placeholder: "fair use" }];
  if (path.includes("{act_id}") || path.endsWith("/sections")) return [{ name: "act_id", placeholder: "MOCK_USC_T42_S1983" }];
  return [];
};

type Res = { request_id: string; latency_ms: number; credits_used: number; data: unknown } | null;

export default function PlaygroundClient() {
  const [id, setId] = useState(`${endpoints[0].method} ${endpoints[0].path}`); // method+path: two endpoints share /api/v1/watches
  const [vals, setVals] = useState<Record<string, string>>({});
  const [res, setRes] = useState<Res>(null);
  const [view, setView] = useState<"Visual" | "JSON">("Visual");
  const [busy, setBusy] = useState(false);
  const ep = endpoints.find((e) => `${e.method} ${e.path}` === id)!;
  const path = ep.path;
  const params = useMemo(() => paramsFor(path), [path]);

  async function run() {
    setBusy(true);
    try {
      const r = await fetch("/api/mock/playground", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, method: ep.method, params: Object.fromEntries(params.map((p) => [p.name, vals[p.name] || p.placeholder])) }) });
      setRes(await r.json());
    } finally { setBusy(false); }
  }

  const curl = `curl ${ep.method === "GET" ? "-G " : "-X POST "}https://api.lexbharat.example${path} \\\n  -H "Authorization: Bearer $LEXBHARAT_API_KEY"${params.map((p) => ` \\\n  --data-urlencode "${p.name}=${vals[p.name] || p.placeholder}"`).join("")}`;
  const items = res && typeof res.data === "object" && res.data !== null ? (Array.isArray(res.data) ? res.data : (res.data as { results?: unknown[] }).results ?? [res.data]) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] [&>*]:min-w-0">
      <div className="space-y-4 rounded-card border border-border bg-surface p-5">
        <DevOnly><p className="text-fs-xs text-muted"><MockBadge>mock console</MockBadge> Runs against <code className="font-mono">/api/mock/playground</code>.</p></DevOnly>
        <div>
          <label htmlFor="pg-ep" className="mb-1 block text-fs-ui font-medium">Endpoint</label>
          <select id="pg-ep" value={id} onChange={(e) => { setId(e.target.value); setRes(null); }} className="w-full rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 font-mono text-fs-12.5">
            {endpoints.map((e) => <option key={`${e.method} ${e.path}`} value={`${e.method} ${e.path}`}>{e.method} {e.path}</option>)}
          </select>
          <p className="mt-1 text-fs-sm text-muted">{ep.summary}</p>
        </div>
        {params.map((p) => (
          <div key={p.name}>
            <label htmlFor={`pg-${p.name}`} className="mb-1 block text-fs-ui font-medium">{p.name}</label>
            <input id={`pg-${p.name}`} className="w-full rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-fs-body" placeholder={p.placeholder} value={vals[p.name] ?? ""} onChange={(e) => setVals({ ...vals, [p.name]: e.target.value })} />
          </div>
        ))}
        <button onClick={run} disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-60">{busy ? "Running…" : "Run request"}</button>
      </div>

      <div className="rounded-panel border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2">
          <div role="tablist" className="flex gap-1">
            {(["Visual", "JSON"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded-control px-3 py-1 text-fs-ui ${view === v ? "bg-raised font-medium" : "text-muted hover:text-foreground"}`}>{v}</button>
            ))}
          </div>
          {res && <p className="px-2 font-mono text-fs-xs text-muted">{res.request_id} · {res.latency_ms} ms · {res.credits_used} credits</p>}
        </div>
        <div className="min-h-[260px] p-5 text-fs-body">
          {!res ? <p className="text-muted">Pick an endpoint and press “Run request”.</p> : view === "JSON" ? (
            <pre tabIndex={0} className="overflow-x-auto font-mono text-fs-xs leading-5">{JSON.stringify(res, null, 2)}</pre>
          ) : (
            <ul className="space-y-3">
              {items.map((it, i) => {
                const o = it as Record<string, unknown>;
                return (
                  <li key={i} className="rounded-control border border-border p-3">
                    <p className="font-semibold">{String(o.cite ?? o.label ?? o.jurisdiction ?? `Result ${i + 1}`)}</p>
                    {o.title ? <p className="text-muted">{String(o.title)}</p> : null}
                    {o.excerpt ? <p className="mt-1 text-fs-ui">{String(o.excerpt)}</p> : null}
                    {!o.title && !o.excerpt ? <pre tabIndex={0} className="overflow-x-auto font-mono text-fs-xs">{JSON.stringify(o)}</pre> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-4">
          <p className="mb-2 text-fs-sm font-medium">Equivalent call</p>
          <pre tabIndex={0} className="overflow-x-auto rounded-control bg-[var(--code-bg)] p-3 font-mono text-fs-xs leading-5">{curl}</pre>
        </div>
      </div>
    </div>
  );
}
