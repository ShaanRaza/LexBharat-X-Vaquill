"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Listbox, { type LbItem } from "./Listbox";
import DevOnly from "@/components/DevOnly";
import MockBadge from "@/components/MockBadge";
import { creditCost, type SpecEndpoint, type SpecField } from "@/data/playgroundSpec";
import { buildRequest, buildSnippet, coerce, isFilled, type FormValues, type Lang } from "@/lib/playgroundCode";
import { useMockKey } from "@/lib/useMockKey";

// The Playground clone. Behavior comes from docs/PLAYGROUND-TEARDOWN.md.
// CONFIRMED there: spec-driven forms, picker listing only runnable endpoints grouped by tag, key banner + disabled Run + footer hint,
// Run -> Cancel + live timer + skeleton, "Results (N)" header with status chip / duration / copy, Visual|JSON toggles, Output|Code tabs,
// cURL|Python|JavaScript, Recent runs ("kept in this tab only"; selecting reloads without sending), privacy notice, Pricing visual layout.
// INFERRED here (labelled "INFERRED" where it happens): the help tour, the Copy-link encoding, other endpoints' visual renderers, the
// per-endpoint remembered form values, the 10-run history cap, the narrow-screen layout.

type Meta = { elapsedMs: number; requestId: string | null; rateLimit: { limit: number | null; remaining: number | null; reset: number | null }; url: string; method: string };
type Result = { status: number; ok: boolean; body: unknown; meta: Meta; ms: number };
type Run = { id: string; endpointId: string; name: string; values: FormValues; result: Result; at: number };

const RECENT_KEY = "lb_pg_recent";
const RECENT_MAX = 10; // INFERRED
const TAG_ORDER: SpecEndpoint["tag"][] = ["Pricing", "US Statutes", "US Session Laws", "Board Watches", "Credits"];
const GROUP_ORDER = ["Search", "Section Lookup", "Citations", "Lookup", "Browse"]; // INFERRED sub-heading order
const LABELS: Record<string, string> = { corpusType: "Corpus", state: "Jurisdiction", limit: "Results per page", offset: "Skip", includeBody: "Include first page of text", query: "Query", region: "Region" };
const labelOf = (name: string) => LABELS[name] ?? (name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^./, (c) => c.toUpperCase()));
const fmtS = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** UI-side starting values. Confirmed: the search form and its Code view start with limit 5 although the spec default is 10. */
const seedValues = (e: SpecEndpoint): FormValues => (e.path.endsWith("/us/statutes/search") ? { limit: "5" } : {});

const btnBase = "inline-flex items-center justify-center whitespace-nowrap rounded-[4px] font-medium transition-[background-color,color,opacity,transform] duration-150 ease-out motion-reduce:transition-none focus-visible:outline-2";

function MethodBadge({ m }: { m: string }) {
  const c = m === "GET" ? "bg-[#10b781]/15 text-[#0b7556]" : m === "POST" ? "bg-[#3b82f6]/15 text-[#1d5aa8]" : m === "DELETE" ? "bg-error/15 text-[#b42323]" : "bg-warning/15 text-warning";
  return <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-semibold ${c}`}>{m}</span>;
}

function renderDesc(s: string) {
  return s.split(/(`[^`]+`)/g).map((p, i) => (p.startsWith("`") ? <code key={i} className="rounded-[3px] bg-accent px-1 font-mono text-[11px]">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>));
}

function Clamp({ children, long }: { children: React.ReactNode; long: boolean }) {
  const [more, setMore] = useState(false);
  return (
    <div>
      <div className={!more && long ? "max-h-[5.2rem] overflow-hidden" : ""}>{children}</div>
      {long && <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="-ml-1 mt-0.5 inline-flex min-h-6 items-center rounded-[3px] px-1 text-[12px] text-primary underline underline-offset-2">{more ? "Show less" : "Show more"} {more ? "▴" : "▾"}</button>}
    </div>
  );
}

function SwitchBtn({ id, label, on, onClick }: { id: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-[#c9c3b8]"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  );
}

const inputCls = "w-full rounded-[4px] border border-transparent bg-accent px-3 py-2 text-[14px] outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:bg-background";

function FieldBlock({ f, value, set }: { f: SpecField; value: FormValue; set: (v: FormValue) => void }) {
  const id = `pg-${f.name}`;
  const err = fieldError(f, value);
  const lines = typeof value === "string" ? value.split("\n").filter((x) => x.trim()).length : 0;
  const range = f.kind === "number" && (f.min !== undefined || f.max !== undefined) ? `${f.min ?? ""}${f.max !== undefined ? `-${f.max}` : f.min !== undefined ? "+" : ""}` : "";
  const long = f.description.length > 220 || !!f.enumLabels;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[16px] font-medium">{labelOf(f.name)} <span className="ml-1 font-mono text-[11px] font-normal text-muted">{f.name}</span>{f.required && <span className="ml-1 text-error" aria-hidden>*</span>}</label>
        {range && <span className="font-mono text-[11px] text-muted">{range}</span>}
      </div>
      <Clamp long={long}>
        <p className="text-[13px] leading-relaxed text-muted">{renderDesc(f.description)}</p>
        {f.enumLabels && f.enum && (
          <ul data-lenis-prevent className="mt-2 max-h-28 overflow-y-auto rounded-[6px] bg-accent p-2 text-[12px]">
            {f.enum.map((t) => <li key={t} className="flex gap-2 py-0.5"><span className="shrink-0 rounded-[3px] bg-surface px-1.5 font-mono text-[11px]">{t}</span><span className="text-muted">{f.enumLabels?.[t]}</span></li>)}
          </ul>
        )}
      </Clamp>

      {f.kind === "enum" && (
        <Listbox id={id} ariaLabel={labelOf(f.name)} value={typeof value === "string" ? value : ""} onChange={(v) => set(v || undefined)} maxHeight="max-h-64"
          triggerClass={`${inputCls} flex cursor-pointer items-center justify-between text-left`}
          triggerContent={<><span>{typeof value === "string" && value ? <span className="font-mono text-[13px]">{value}</span> : <>Any{f.default !== undefined && <span className="ml-2 font-mono text-[12px] text-muted">{String(f.default)}</span>}</>}</span><span aria-hidden className="text-[10px] text-muted">▾</span></>}
          items={[{ kind: "option", value: "", text: "any", label: <span>Any</span> }, ...(f.enum ?? []).map((t) => ({ kind: "option" as const, value: t, text: t, label: <span className="font-mono text-[13px]">{t}</span> }))]} />
      )}
      {f.kind === "number" && (
        <div className="flex flex-wrap items-center gap-2">
          {f.presets && (
            <div role="group" aria-label={`${labelOf(f.name)} presets`} className="flex rounded-[6px] bg-accent p-0.5">
              {f.presets.map((p) => <button key={p} type="button" aria-pressed={value === String(p)} onClick={() => set(String(p))} className={`rounded-[4px] px-2.5 py-1 font-mono text-[12px] ${value === String(p) ? "bg-surface shadow-sm" : "text-muted"}`}>{p}</button>)}
            </div>
          )}
          <input id={id} type="number" inputMode="numeric" min={f.min} max={f.max} step={f.integer ? 1 : "any"} value={typeof value === "string" ? value : ""} placeholder={f.default !== undefined ? String(f.default) : ""} aria-label={`${labelOf(f.name)}${range ? `, ${range.replace("-", " to ")}` : ""}`}
            aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}
            onChange={(e) => set(e.target.value)} className={`${inputCls} font-mono ${f.presets ? "w-28" : "w-40"} ${err ? "!border-error" : ""}`} />
          {err && <p id={`${id}-err`} role="alert" className="basis-full text-[12px] text-[#b42323]">{err}</p>}
        </div>
      )}
      {f.kind === "boolean" && (
        <div className="flex items-center gap-3">
          <SwitchBtn id={id} label={labelOf(f.name)} on={value === undefined ? !!f.default : value === true} onClick={() => set(!(value === undefined ? !!f.default : value === true))} />
          <span className="text-[13px] text-muted">{value === undefined ? `default: ${String(!!f.default)}` : value ? "true" : "false"}</span>
        </div>
      )}
      {f.kind === "date" && <input id={id} type="date" aria-label={labelOf(f.name)} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} className={`${inputCls} w-48`} />}
      {f.kind === "text" && !f.multi && <input id={id} type="text" value={typeof value === "string" ? value : ""} placeholder={f.example !== undefined ? String(f.example) : ""} onChange={(e) => set(e.target.value)} className={inputCls} />}
      {(f.kind === "textarea" || f.kind === "array" || (f.kind === "text" && f.multi)) && (
        <div>
          <textarea id={id} rows={2} value={typeof value === "string" ? value : ""} placeholder={f.example !== undefined ? String(f.example) : "one per line"} onChange={(e) => set(e.target.value)} className={`${inputCls} resize-y font-mono text-[13px]`} />
          <p className="mt-1 flex justify-between text-[11px] text-muted"><span>one per line</span><span>{lines} value{lines === 1 ? "" : "s"}</span></p>
        </div>
      )}
    </div>
  );
}
type FormValue = FormValues[string];

function RunButton({ running, elapsed, disabled, onRun, onCancel, title }: { running: boolean; elapsed: number; disabled: boolean; onRun: () => void; onCancel: () => void; title?: string }) {
  if (running) return <button type="button" onClick={onCancel} className={`${btnBase} h-9 gap-2 bg-accent px-3 text-[13px] text-foreground ring-1 ring-border hover:bg-sunken`}><span aria-hidden>▢</span>Cancel <span className="font-mono text-[12px] text-muted" aria-live="off">{fmtS(elapsed)}</span></button>;
  return (
    <button type="button" onClick={onRun} disabled={disabled} title={title}
      className={`${btnBase} h-9 gap-2 bg-primary px-3 text-[13px] text-white hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary`}>
      <span aria-hidden>▷</span>Run <kbd className="rounded-[3px] bg-white/25 px-1.5 py-0.5 font-sans text-[11px]">⌘↵</kbd>
    </button>
  );
}

function StatusChip({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ring-1 ${ok ? "bg-success/15 text-[#0b7556] ring-success/40" : "bg-error/10 text-[#b42323] ring-error/40"}`}>{status}</span>;
}

// ---- Visual renderers (Pricing layout CONFIRMED; the rest INFERRED) -----------------------------------------------------
type Cost = { endpoint: string; operation: string; credits: number; usdCost: number; description: string; category: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const arrayOf = (b: unknown): unknown[] | null => {
  if (Array.isArray(b)) return b;
  if (isObj(b)) for (const k of ["costs", "results", "items", "sections", "boards", "resolved", "divisions", "events", "citedBy", "definitions", "comparisons", "enactments", "citations", "jurisdictions", "before"]) if (Array.isArray(b[k])) return b[k] as unknown[];
  return null;
};
const catLabel = (c: string) => c.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase());

function Visual({ result }: { result: Result }) {
  const b = result.body;
  if (!result.ok) {
    const msg = isObj(b) && typeof b.error === "string" ? b.error : "Request failed.";
    return <div role="alert" className="rounded-[6px] border border-error/40 bg-error/5 p-4 text-[14px]"><p className="font-medium text-[#b42323]">Error {result.status}</p><p className="mt-1">{msg}</p></div>;
  }
  if (isObj(b) && Array.isArray(b.costs)) {
    const costs = b.costs as Cost[];
    return (
      <div>
        <p className="mb-4 text-[13px] text-muted"><strong className="font-semibold text-foreground">${Number(b.dollarPerCredit).toFixed(4)}</strong> per credit · {Number(b.minCredits).toLocaleString()}-{Number(b.maxCredits).toLocaleString()} credits per purchase</p>
        <ul className="divide-y divide-border">
          {costs.map((c) => (
            <li key={c.endpoint} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed">{c.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-[4px] bg-accent px-2 py-0.5 text-[11px]">{catLabel(c.category)}</span><span className="rounded-[4px] bg-accent px-2 py-0.5 font-mono text-[11px]">{c.endpoint} · {c.operation}</span></div>
              </div>
              <div className="shrink-0 text-right"><span className="rounded-full bg-accent px-2.5 py-0.5 font-mono text-[12px] ring-1 ring-border">{c.credits} credit{c.credits === 1 ? "" : "s"}</span><p className="mt-1 text-[12px] text-muted">${c.usdCost.toFixed(2)}/call</p></div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const arr = arrayOf(b);
  if (arr && arr.length && isObj(arr[0])) {
    return (
      <ul className="space-y-3">
        {arr.map((r, i) => {
          const o = r as Record<string, unknown>;
          const title = String(o.citation ?? o.title ?? o.label ?? o.term ?? o.publicLaw ?? o.name ?? o.id ?? o.kind ?? `Result ${i + 1}`);
          const tags = [o.corpusType, o.state, o.actStatus, o.goodLawStatus].filter((x): x is string => typeof x === "string");
          return (
            <li key={i} className="rounded-[6px] border border-border p-3">
              <p className="text-[14px] font-medium">{title}</p>
              {typeof o.title === "string" && o.citation ? <p className="text-[13px] text-muted">{o.title}</p> : null}
              {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="rounded-[4px] bg-accent px-2 py-0.5 font-mono text-[11px]">{t}</span>)}</div>}
              {typeof o.excerpt === "string" && <p className="mt-2 text-[13px] leading-relaxed">{o.excerpt}</p>}
              {typeof o.actId === "string" && <p className="mt-2 font-mono text-[11px] text-muted">{o.actId}</p>}
            </li>
          );
        })}
      </ul>
    );
  }
  if (isObj(b)) {
    return (
      <dl className="space-y-2 text-[13px]">
        {Object.entries(b).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 border-b border-border/60 pb-2 sm:flex-row sm:gap-4"><dt className="w-40 shrink-0 font-mono text-[12px] text-muted">{k}</dt><dd className="min-w-0 break-words">{typeof v === "object" ? <pre className="whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(v, null, 2)}</pre> : String(v)}</dd></div>
        ))}
      </dl>
    );
  }
  return <pre className="font-mono text-[11px]">{JSON.stringify(b, null, 2)}</pre>;
}

// Segmented control with roving arrow-key navigation (WAI-ARIA tabs pattern, automatic activation).
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: React.ReactNode; text: string }[]; onChange: (v: T) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: React.KeyboardEvent, i: number) => {
    const n = options.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault(); onChange(options[to].id); refs.current[to]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[6px] bg-accent p-0.5">
      {options.map((o, i) => (
        <button key={o.id} ref={(el) => { refs.current[i] = el; }} role="tab" aria-selected={value === o.id} tabIndex={value === o.id ? 0 : -1} aria-label={o.text}
          onClick={() => onChange(o.id)} onKeyDown={(e) => move(e, i)}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[13px] transition-colors ${value === o.id ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}>{o.label}</button>
      ))}
    </div>
  );
}

const CopyBtn = ({ onCopy, label, light }: { onCopy: () => void; label: string; light?: boolean }) => {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={done ? "Copied" : label} onClick={() => { onCopy(); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className={`rounded-[4px] p-1.5 transition-colors ${light ? "text-[#b5aea3] hover:bg-white/10 hover:text-white" : "text-muted hover:bg-accent hover:text-foreground"}`}>
      {done
        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>}
    </button>
  );
};

// Code block. Confirmed on the live JavaScript view: a line-number gutter and a highlighted VAQUILL_API_KEY. The live cURL view showed neither,
// and Python was not captured, so the gutter and highlight are applied to JavaScript only (INFERRED for the other two).
function CodeBlock({ lang, code, onCopy }: { lang: Lang; code: string; onCopy: () => void }) {
  const numbered = lang === "JavaScript";
  const rows = code.split("\n");
  const hl = (t: string) => t.split(/(VAQUILL_API_KEY)/).map((p, i) => (p === "VAQUILL_API_KEY" ? <mark key={i} className="rounded-[3px] bg-[#e0b341]/30 px-0.5 text-inherit">{p}</mark> : p));
  return (
    <div className="rounded-[6px] bg-[#1d1a16] text-[#f3f0ec]">
      <div className="flex items-center justify-between px-4 pt-2 font-mono text-[10px] uppercase tracking-wider text-[#a39c91]"><span>{lang}</span><CopyBtn light label="Copy code" onCopy={onCopy} /></div>
      <pre data-lenis-prevent tabIndex={0} aria-label={`${lang} snippet`} className="overflow-x-auto px-4 pb-4 pt-1 font-mono text-[11px] leading-[1.7] outline-none focus-visible:ring-1 focus-visible:ring-white/40">
        <code className="grid" style={{ gridTemplateColumns: numbered ? "auto 1fr" : "1fr" }}>
          {rows.map((r, i) => (
            <span key={i} className="contents">
              {numbered && <span aria-hidden className="select-none pr-4 text-right text-[#6f685e]">{i + 1}</span>}
              <span className="whitespace-pre">{numbered ? hl(r) : r}{"\n"}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

// INFERRED client-side validation: the live spec carries min/max, but the exact messages were not captured.
function fieldError(f: SpecField, v: FormValue): string {
  if (f.kind !== "number" || typeof v !== "string" || v.trim() === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return `${labelOf(f.name)} must be a number.`;
  if (f.integer && !Number.isInteger(n)) return `${labelOf(f.name)} must be a whole number.`;
  if (f.min !== undefined && n < f.min) return `${labelOf(f.name)} must be at least ${f.min}.`;
  if (f.max !== undefined && n > f.max) return `${labelOf(f.name)} must be at most ${f.max}.`;
  return "";
}

// ---- Main component -----------------------------------------------------------------------------------------------------
export default function PlaygroundApp({ initialEndpoint }: { initialEndpoint: string | null }) {
  const { key, ready, create } = useMockKey();
  const [spec, setSpec] = useState<SpecEndpoint[] | null>(null);
  const [specErr, setSpecErr] = useState(false);
  const [endpointId, setEndpointId] = useState("get:/api/v1/api-credits/pricing");
  const [valuesById, setValuesById] = useState<Record<string, FormValues>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [tab, setTab] = useState<"output" | "code">("output");
  const [view, setView] = useState<"visual" | "json">("visual");
  const [lang, setLang] = useState<Lang>("cURL");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recent, setRecent] = useState<Run[]>([]);
  const [toast, setToast] = useState("");
  const [tour, setTour] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const runSeq = useRef(0); // guards against a cancelled run finishing after a newer run started
  const [announce, setAnnounce] = useState("");
  const t0 = useRef(0);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2200); }, []);

  const loadSpec = useCallback(() => {
    setSpecErr(false); setSpec(null);
    fetch("/api/playground/spec?jurisdiction=US").then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j: { endpoints: SpecEndpoint[] }) => setSpec(j.endpoints)).catch(() => setSpecErr(true));
  }, []);
  useEffect(() => { loadSpec(); }, [loadSpec]);

  useEffect(() => { try { const r = sessionStorage.getItem(RECENT_KEY); if (r) setRecent(JSON.parse(r) as Run[]); } catch { /* session storage unavailable: history lives in memory only */ } }, []);
  const saveRecent = (r: Run[]) => { setRecent(r); try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* ignore */ } };

  const runnable = useMemo(() => (spec ?? []).filter((e) => e.runnable), [spec]);
  useEffect(() => { if (initialEndpoint && runnable.some((e) => e.id === initialEndpoint)) setEndpointId(initialEndpoint); }, [initialEndpoint, runnable]);
  const ep = runnable.find((e) => e.id === endpointId) ?? runnable[0];
  const values = ep ? (valuesById[ep.id] ?? seedValues(ep)) : {};
  const setField = (name: string, v: FormValue) => ep && setValuesById((m) => ({ ...m, [ep.id]: { ...(m[ep.id] ?? seedValues(ep)), [name]: v } }));

  const items = useMemo<LbItem[]>(() => {
    const out: LbItem[] = [];
    for (const tag of TAG_ORDER) {
      const list = runnable.filter((e) => e.tag === tag);
      if (!list.length) continue;
      out.push({ kind: "group", label: tag });
      const groups = [...new Set(list.map((e) => e.group ?? ""))].sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
      for (const g of groups) {
        if (g) out.push({ kind: "sub", label: g });
        for (const e of list.filter((x) => (x.group ?? "") === g)) {
          out.push({ kind: "option", value: e.id, text: e.name, label: (
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2"><MethodBadge m={e.method} /><span className="font-medium">{e.name}</span><span className="font-mono text-[11px] text-muted">{e.path}</span></div>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{e.summary}</p>
            </div>
          ) });
        }
      }
    }
    return out;
  }, [runnable]);

  // ---- derived run state
  const primary = ep?.fields.find((f) => f.required && f.kind === "textarea");
  const rest = ep ? ep.fields.filter((f) => f !== primary) : [];
  const cost = ep ? creditCost(ep.path) : null;
  const needsKey = !!ep?.auth && !key;
  const missing = ep?.fields.find((f) => f.required && !isFilled(f, values[f.name]));
  const blocked = needsKey ? "Create an API key above to run this request." : missing ? `${labelOf(missing.name)} is required to run this request.` : "";
  const invalid = ep ? ep.fields.map((f) => fieldError(f, values[f.name])).find(Boolean) ?? "" : "";
  const blockedAll = blocked || invalid;
  const canRun = !!ep && !blockedAll && !running;

  const run = useCallback(async () => {
    if (!ep || !canRun) return;
    const payload: Record<string, unknown> = {};
    for (const f of ep.fields) { const c = coerce(f, values[f.name]); if (c !== undefined) payload[f.name] = c; }
    const ac = new AbortController(); abort.current = ac;
    const seq = ++runSeq.current;
    t0.current = performance.now(); setElapsed(0); setRunning(true); setResult(null); setTab("output"); setAnnounce("Running request");
    try {
      const res = await fetch("/api/playground/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpointId: ep.id, values: payload, apiKey: ep.auth ? key : null }), signal: ac.signal });
      const env = (await res.json()) as Omit<Result, "ms">;
      if (seq !== runSeq.current) return; // cancelled or superseded while the body was parsing
      const r: Result = { ...env, ms: performance.now() - t0.current };
      setResult(r); setResultFor(ep.id); setAnnounce(`Request finished with status ${r.status}`);
      saveRecent([{ id: Math.random().toString(36).slice(2), endpointId: ep.id, name: ep.name, values, result: r, at: Date.now() }, ...recent].slice(0, RECENT_MAX));
    } catch (e) {
      if ((e as Error).name !== "AbortError" && seq === runSeq.current) { setAnnounce("Request failed"); setResult({ status: 0, ok: false, body: { error: "Network error: could not reach the local mock server." }, meta: { elapsedMs: 0, requestId: null, rateLimit: { limit: null, remaining: null, reset: null }, url: "", method: "" }, ms: performance.now() - t0.current }); setResultFor(ep.id); }
    } finally { if (seq === runSeq.current) { setRunning(false); abort.current = null; } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ep, canRun, values, key, recent]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(performance.now() - t0.current), 50);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => () => { runSeq.current++; abort.current?.abort(); }, []);
  useEffect(() => {
    if (tour === null) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setTour(null); };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [tour]);

  const cancel = () => { runSeq.current++; abort.current?.abort(); abort.current = null; setRunning(false); setAnnounce("Request cancelled"); };
  const pick = (id: string) => { if (running) cancel(); setEndpointId(id); setResult(null); setResultFor(null); };
  const reload = (r: Run) => { if (running) cancel(); setEndpointId(r.endpointId); setValuesById((m) => ({ ...m, [r.endpointId]: r.values })); setResult(r.result); setResultFor(r.endpointId); setTab("output"); say("Loaded a previous run. Nothing was sent."); };
  const copy = (text: string, msg: string) => { navigator.clipboard?.writeText(text).then(() => say(msg), () => say("Copy failed.")); };
  // INFERRED: the live "Copy link" payload was not captured; this encodes the selected endpoint only (never values or keys).
  const copyLink = () => copy(`${location.origin}/developer?tab=playground&endpoint=${encodeURIComponent(ep?.id ?? "")}`, "Link copied");

  if (specErr) return <div className="max-w-[880px] pt-2"><h1 className="text-[21px] font-semibold">Playground</h1><div role="alert" className="mt-4 rounded-[8px] border border-error/40 bg-error/5 p-4 text-[14px]">Could not load the endpoint list. <button type="button" onClick={loadSpec} className="ml-2 text-primary underline">Retry</button></div></div>;
  if (!spec || !ep) return <div className="max-w-[880px] pt-2" aria-busy="true"><h1 className="text-[21px] font-semibold">Playground</h1><div className="console-skel mt-4 h-10 rounded-[6px] bg-accent" /><div className="console-skel mt-4 h-64 rounded-[8px] bg-surface" /></div>;

  const shownResult = result && resultFor === ep.id ? result : null;
  const count = shownResult ? arrayOf(shownResult.body)?.length : undefined;
  const json = shownResult ? JSON.stringify(shownResult.body, null, 2) : "";
  const snippet = buildSnippet(ep, values, lang);
  const tourSteps: [string, string][] = [ // INFERRED: the live "Walk me through Playground" tour did not open during the teardown
    ["Pick an endpoint", "The bar at the top lists every endpoint you can run, grouped by area."],
    ["Fill in the parameters", "The form is generated from the endpoint's spec. Required fields are marked."],
    ["Run it", "Press Run or ⌘↵. Paid endpoints need an API key; Pricing is free."],
    ["Read and copy", "Switch between Visual and JSON, or open Code for cURL, Python and JavaScript."],
  ];

  return (
    <div className="max-w-[880px] pt-2" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void run(); } }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="text-[21px] font-semibold">Playground</h1><p className="mt-0.5 text-[14px] text-muted">Run live requests against the API</p></div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={copyLink} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-2.5 text-[13px] hover:bg-accent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>Copy link</button>
          <button type="button" aria-label="Walk me through Playground" onClick={() => setTour(0)} className="grid h-8 w-8 place-items-center rounded-full text-[13px] text-muted hover:bg-accent">?</button>
        </div>
      </div>

      {tour !== null && (
        <div role="dialog" aria-label="Playground tour" className="relative z-20 ml-auto mt-2 w-full max-w-[320px] rounded-[8px] bg-surface p-4 shadow-lg ring-1 ring-border">
          <p className="text-[11px] uppercase tracking-wide text-muted">Step {tour + 1} of {tourSteps.length}</p>
          <p className="mt-1 font-medium">{tourSteps[tour][0]}</p><p className="mt-1 text-[13px] text-muted">{tourSteps[tour][1]}</p>
          <div className="mt-3 flex justify-between"><button type="button" onClick={() => setTour(null)} className="text-[13px] text-muted hover:text-foreground">Skip</button>
            <div className="flex gap-2">{tour > 0 && <button type="button" onClick={() => setTour(tour - 1)} className="h-8 rounded-[4px] px-3 text-[13px] ring-1 ring-border">Back</button>}
              <button type="button" onClick={() => setTour(tour + 1 >= tourSteps.length ? null : tour + 1)} className="h-8 rounded-[4px] bg-primary px-3 text-[13px] text-white">{tour + 1 >= tourSteps.length ? "Done" : "Next"}</button></div></div>
        </div>
      )}

      {/* Endpoint picker */}
      <p className="mt-4 text-[12px] font-medium uppercase tracking-wide text-muted">Sample US endpoints (demo)</p>
      <div className="mt-1.5">
        <Listbox ariaLabel="Endpoint" value={ep.id} onChange={pick} items={items} panelClass="w-[min(32rem,92vw)]" maxHeight="max-h-[min(36rem,80vh)]"
          triggerClass="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[6px] bg-accent px-3 py-2 text-left text-[14px]"
          triggerContent={<><span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5"><MethodBadge m={ep.method} /><span className="font-medium">{ep.name}</span><span className="truncate font-mono text-[12px] text-muted">{ep.path}</span></span><span aria-hidden className="text-[11px] text-muted">▾</span></>} />
      </div>

      {needsKey && ready && (
        <div className="mt-4 rounded-[8px] bg-accent p-4 ring-1 ring-border">
          <p className="flex items-center gap-2 font-medium"><span aria-hidden>🔑</span>Create an API key to start</p>
          <p className="mt-1 text-[13px] text-muted">One click. The key works here and anywhere else you need it, and will be here next time you sign in.</p>
          <button type="button" onClick={() => { create(); say("Mock API key created. It lives only in this browser."); }} className={`${btnBase} mt-3 h-9 gap-2 bg-primary px-3 text-[13px] text-white hover:bg-primary-hover`}>Create API key</button>
          <p className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-[2px] border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">Mock key</span> <span className="text-[12px] text-muted">A random string kept in this browser; it unlocks nothing real.</span></p>
        </div>
      )}

      {/* Form */}
      <section aria-label="Request" className="mt-4 rounded-[8px] bg-surface p-5 shadow-sm ring-1 ring-border/60">
        {primary ? (
          <div>
            <label htmlFor="pg-primary" className="text-[16px] font-medium">{labelOf(primary.name)} <span className="ml-1 font-mono text-[11px] font-normal text-muted">{primary.name}</span></label>
            <div className="mt-2 rounded-[6px] bg-accent p-3 transition-colors focus-within:bg-background focus-within:ring-1 focus-within:ring-primary">
              <textarea id="pg-primary" rows={4} maxLength={primary.maxLength} placeholder={primary.example !== undefined ? String(primary.example) : ""} value={typeof values[primary.name] === "string" ? (values[primary.name] as string) : ""}
                onChange={(e) => setField(primary.name, e.target.value)} className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted/70" />
              <div className="mt-2 flex items-center justify-between gap-3">
                {cost !== null ? <span className="rounded-full bg-surface/70 px-2 py-0.5 font-mono text-[11px] text-muted ring-1 ring-border">{cost} credit{cost === 1 ? "" : "s"}</span> : <span />}
                <RunButton running={running} elapsed={elapsed} disabled={!canRun} onRun={run} onCancel={cancel} title={blockedAll} />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted">{ep.summary}</p>
        )}

        {(rest.length > 0 || primary?.examples) && (
          <div className={primary ? "mt-6" : "mt-5"}>
            <h2 className="text-[17px]">Parameters</h2>
            {primary?.examples && (
              <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[11px] uppercase tracking-[0.12em] text-muted">Examples</span>
                {primary.examples.map((x, i) => <button key={x} type="button" aria-pressed={values[primary.name] === (i === 0 ? "notice required before terminating an at-will employee" : x)}
                  onClick={() => setField(primary.name, i === 0 ? "notice required before terminating an at-will employee" : x)} // first chip's text is CONFIRMED; the others are INFERRED
                  className="rounded-full bg-accent px-3 py-1.5 text-[13px] ring-1 ring-transparent hover:ring-border aria-pressed:ring-primary">{x}</button>)}
              </div>
            )}
            <div className="mt-4 space-y-6">
              {rest.map((f) => <FieldBlock key={`${ep.id}:${f.name}`} f={f} value={values[f.name]} set={(v) => setField(f.name, v)} />)}
            </div>
          </div>
        )}
        {ep.fields.length === 0 && <p className="mt-3 text-[13px] text-muted">This endpoint takes no parameters.</p>}

        {!primary && (
          <div className="mt-6 flex items-center gap-3"><RunButton running={running} elapsed={elapsed} disabled={!canRun} onRun={run} onCancel={cancel} title={blockedAll} />{cost ? <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] text-muted">{cost} credit{cost === 1 ? "" : "s"}</span> : null}</div>
        )}
        {blockedAll && <p className="mt-4 flex items-center gap-2 text-[13px] text-muted"><span aria-hidden>{needsKey ? "🔑" : ""}</span>{blockedAll}</p>}
      </section>

      <div className="mt-4 flex items-start gap-2 text-[13px] text-muted"><span aria-hidden className="mt-0.5">🛡</span>
        <p><strong className="font-medium text-foreground">The API does not store your query text.</strong> Requests exist in memory for the length of the call. We keep per-day call counts for billing, not what you searched for. <strong className="font-medium text-foreground">(Local mock: requests never leave this computer.)</strong> <a href="/security" className="text-primary underline underline-offset-2">What we store</a>{" "}
          <DevOnly><MockBadge>statement copied from the live UI</MockBadge></DevOnly></p></div>

      {recent.length > 0 && (
        <section aria-label="Recent runs" className="mt-4 rounded-[8px] bg-surface p-5 ring-1 ring-border/60">
          <div className="flex items-center justify-between"><h2 className="text-[17px]">Recent runs</h2><button type="button" onClick={() => saveRecent([])} className="text-[13px] hover:underline">Clear</button></div>
          <p className="mt-2 text-[13px] text-muted">Kept in this tab only. Selecting a run reloads its request without sending it.</p>
          <ul className="mt-2">
            {recent.map((r) => (
              <li key={r.id}><button type="button" onClick={() => reload(r)} className="flex w-full items-center justify-between gap-3 rounded-[4px] px-1 py-2 text-left hover:bg-accent">
                <span className="truncate text-[14px]">{r.name}</span>
                <span className="flex shrink-0 items-center gap-3 font-mono text-[12px] text-muted"><StatusChip status={r.result.status} /><span>{fmtS(r.result.ms)}</span><span>{clock(r.at)}</span></span>
              </button></li>
            ))}
          </ul>
        </section>
      )}

      {/* Output / Code */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Panel" value={tab} onChange={setTab} options={[
          { id: "output", text: "Output", label: <><span aria-hidden className="font-mono text-[11px]">▤</span>Output</> },
          { id: "code", text: "Code", label: <><span aria-hidden className="font-mono text-[11px]">&lt;/&gt;</span>Code</> },
        ]} />
        {tab === "output"
          ? <Segmented label="Output format" value={view} onChange={setView} options={[{ id: "visual", text: "Visual", label: <><span aria-hidden>👁</span>Visual</> }, { id: "json", text: "JSON", label: <><span aria-hidden className="font-mono text-[11px]">{"{ }"}</span>JSON</> }]} />
          : <Segmented label="Language" value={lang} onChange={setLang} options={(["cURL", "Python", "JavaScript"] as const).map((l) => ({ id: l, text: l, label: <>{l}</> }))} />}
      </div>

      <section aria-label={tab === "output" ? "Output" : "Code"} className="mt-3 overflow-hidden rounded-[8px] bg-surface ring-1 ring-border/60">
        {tab === "code" ? (
          <div className="p-3">
            <CodeBlock lang={lang} code={snippet} onCopy={() => copy(snippet, "Code copied")} />
            <DevOnly><p className="mt-2 text-[12px] text-muted"><MockBadge>reproduced bug</MockBadge> The JavaScript snippet omits the comma after <code className="font-mono">method: &quot;POST&quot;</code>, exactly as the live product does.</p></DevOnly>
          </div>
        ) : running ? (
          <div className="p-5" aria-busy="true">
            <div className="flex items-center justify-between"><p className="text-[16px]">Running…</p><span className="flex items-center gap-3"><span className="font-mono text-[12px] text-muted">{fmtS(elapsed)}</span><button type="button" onClick={cancel} className="h-8 rounded-[4px] px-3 text-[13px] ring-1 ring-border hover:bg-accent">▢ Cancel</button></span></div>
            <div className="mt-5 divide-y divide-border" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3" style={{ animationDelay: `${i * 120}ms` }}>
                  <div className="min-w-0 flex-1 space-y-2"><div className="console-skel h-3 w-[92%] rounded bg-accent" /><div className="console-skel h-3 w-[64%] rounded bg-accent" /><div className="console-skel mt-3 h-5 w-40 rounded bg-accent" /></div>
                  <div className="space-y-2"><div className="console-skel h-5 w-16 rounded-full bg-accent" /><div className="console-skel ml-auto h-3 w-10 rounded bg-accent" /></div>
                </div>
              ))}
            </div>
          </div>
        ) : shownResult ? (
          <div className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px]">{view === "visual" ? (count !== undefined ? `Results (${count})` : "Response") : "Response body"}</h2>
              <span className="flex items-center gap-2"><span title="This response was generated on this computer" className="rounded-[2px] border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">Mock</span><StatusChip status={shownResult.status} /><span className="font-mono text-[12px] text-muted">{(shownResult.ms / 1000).toFixed(3)}s</span><CopyBtn label="Copy response" onCopy={() => copy(json, "Response copied")} /></span>
            </div>
            <div className="mt-4">{view === "visual" ? <Visual result={shownResult} /> : <pre data-lenis-prevent tabIndex={0} aria-label="JSON response" className="max-h-[560px] overflow-auto rounded-[6px] bg-accent p-3 font-mono text-[11px] leading-[1.6]"><code>{json}</code></pre>}</div>
            <DevOnly><p className="mt-3 text-[12px] text-muted">{ep.path === "/api/v1/api-credits/pricing" ? <MockBadge>pricing body is the confirmed shape</MockBadge> : <MockBadge>invented response shape (inferred)</MockBadge>}</p></DevOnly>
          </div>
        ) : (
          <div className="grid place-items-center px-6 py-14 text-center">
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-[6px] bg-accent text-[18px] text-muted">▷</span>
            <p className="mt-4 text-[16px] font-medium">No response yet</p>
            <p className="mt-1 max-w-[260px] text-[13px] text-muted">Run a request to see the result here, formatted or as raw JSON.</p>
          </div>
        )}
      </section>

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[120] -translate-x-1/2">{toast && <div className="rounded-full bg-foreground px-4 py-2 text-[13px] text-background shadow-lg">{toast}</div>}</div>
    </div>
  );
}
