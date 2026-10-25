"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import CitedText from "@/components/workspace/CitedText";
import FeedbackBar from "../FeedbackBar";
import { NOT_LEGAL_ADVICE } from "@/lib/review/prompts.mjs";
import { SCAN_LABEL } from "@/lib/vault/scan.mjs";
import { CONTRACT_TYPES } from "@/lib/review/rules.mjs";
import type { CitationLite, ReviewRun } from "@/lib/review/store";
import { CLAUSE_BADGE, RISK_BADGE } from "./labels";
import { useReviewRun } from "./useReviewRun";

// One review (/workspace/review/<id>): live progress while it runs, then the result: summary, clauses, suggested changes, missing clauses, Indian-law points with citation chips, and the .docx/PDF downloads.
// Presentation only; the review itself runs on the server (src/lib/review).
const H2 = "text-ui-lead font-semibold";
const BTN = "rounded-chip px-3 py-1.5 text-ui-sm font-medium ring-1 ring-border text-foreground hover:bg-accent focus-visible:outline-2";

function Step({ label, state, onRetry, detail }: { label: string; state: "pending" | "ok" | "failed" | "now"; onRetry?: () => void; detail?: string }) {
  return (
    <li className="py-1.5 text-ui-base">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${state === "ok" ? "bg-quality-complete" : state === "failed" ? "bg-quality-bad" : state === "now" ? "animate-pulse bg-quality-warn" : "bg-border"}`} />
        <span className="min-w-0 flex-1">{label}<span className="sr-only"> — {state === "ok" ? "done" : state === "failed" ? "not reviewed" : state === "now" ? "in progress" : "waiting"}</span></span>
      </div>
      {state === "failed" && (
        <div className="mt-1 flex flex-wrap items-center gap-2 pl-[1.125rem]">
          <span className="text-ui-sm text-quality-bad">Not reviewed{detail ? `: ${detail}` : ""}</span>
          <button type="button" onClick={onRetry} className={BTN}>Retry</button>
        </div>
      )}
    </li>
  );
}

export default function ReviewRunView({ id }: { id: string }) {
  const { run, err, working, retry, auto } = useReviewRun(id), [onlyIssues, setOnlyIssues] = useState(false);
  if (err && !run) return <div className="mx-auto max-w-3xl pb-10"><p className="mt-3 text-ui-sm"><Link href="/workspace/review" className="text-primary hover:underline">← Back to Review</Link></p><Notice tone="bad" role="alert" className="mt-4"><p>{err}</p></Notice></div>;
  if (!run?.result) return <div className="mx-auto max-w-3xl pb-10"><p className="mt-6 text-ui-base text-muted">Loading…</p></div>;
  const res = run.result, sum = res.summary.value, clauses = res.parts.flatMap((p) => p.clauses ?? []);
  const nowIdx = working ? (res.parts.find((p) => p.status === "pending")?.i ?? -1) : -1;
  const summaryNow = working && nowIdx === -1 && res.summary.status === "pending", lawNow = working && nowIdx === -1 && res.summary.status !== "pending" && res.law.status === "pending";
  const changes = clauses.filter((c) => c.change), shown = onlyIssues ? clauses.filter((c) => c.risk !== "acceptable") : clauses;
  const sources: CitationLite[] = res.law.sources ?? [];
  const done = run.status !== "running";
  return (
    <div className="mx-auto max-w-3xl pb-10">
      <p className="mt-3 text-ui-sm"><Link href="/workspace/review" className="text-primary hover:underline">← Back to Review</Link></p>
      <h1 className="mt-4 break-words text-ui-title font-semibold">{run.docName}</h1>
      <p className="mt-2 text-ui-sm text-muted">{CONTRACT_TYPES[run.contractType as keyof typeof CONTRACT_TYPES]?.label ?? run.contractType} · reviewed for: {run.side}</p>
      <Notice tone="warn" role="note" compact className="mt-4"><p><strong className="font-medium text-foreground">{NOT_LEGAL_ADVICE}</strong></p></Notice>
      {!!res.scanPages?.length && <Notice tone="warn" role="note" compact className="mt-3"><p><strong className="font-medium text-foreground">{SCAN_LABEL}.</strong> Pages {res.scanPages.join(", ")} of this document were read from images by a model, so quotes and page numbers on those pages can contain mistakes.</p></Notice>}
      {err && <Notice tone="bad" role="alert" compact className="mt-3"><p>{err}</p></Notice>}

      <Panel as="section" className="mt-5" aria-label="Review progress">
        <h2 className="text-ui-base font-semibold">{done ? (run.status === "failed" ? "The review could not be completed" : run.status === "partial" ? "Review finished, with parts not reviewed" : "Review finished") : "Reviewing…"}</h2>
        {auto && <p role="status" className="mt-1 text-ui-sm text-muted">The free model was busy. Trying again in a few seconds…</p>}
        {!done && <p className="mt-1 text-ui-sm text-muted">You can leave this page and come back; it carries on. The free plan takes a few minutes.</p>}
        <ol className="mt-2 divide-y divide-border/50" aria-live="polite">
          {res.parts.map((p) => <Step key={p.i} label={res.parts.length > 1 ? `Part ${p.i + 1} of ${res.parts.length} of the contract` : "The contract"} state={p.status === "pending" ? (p.i === nowIdx ? "now" : "pending") : p.status} detail={p.error} onRetry={() => retry(p.i)} />)}
          <Step label="Summary and missing clauses" state={res.summary.status === "pending" ? (summaryNow ? "now" : "pending") : res.summary.status} detail={res.summary.error} onRetry={() => retry("summary")} />
          <Step label="Indian law points" state={res.law.status === "pending" ? (lawNow ? "now" : "pending") : res.law.status} detail={res.law.error} onRetry={() => retry("law")} />
        </ol>
      </Panel>

      {done && run.status !== "failed" && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Download this review">
          <a className={BTN} href={`/api/review/${id}/export?format=docx`}>Download .docx</a>
          <a className={BTN} href={`/api/review/${id}/export?format=pdf`}>Download PDF</a>
        </div>
      )}

      {(sum || res.risk) && (
        <Panel as="section" className="mt-6" aria-labelledby="rv-sum">
          <div className="flex flex-wrap items-center gap-2"><h2 id="rv-sum" className={H2}>Summary</h2>{res.risk && <Badge tone={RISK_BADGE[res.risk].tone}>Overall: {RISK_BADGE[res.risk].text}</Badge>}</div>
          {sum ? (
            <>
              <p className="mt-2 text-ui-body">{sum.what}</p>
              {sum.overallWhy && <p className="mt-1 text-ui-base text-secondary">{sum.overallWhy}</p>}
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-ui-base sm:grid-cols-[9rem_1fr]">
                <dt className="font-medium">Parties</dt><dd className="text-secondary">{sum.parties.length ? sum.parties.join("; ") : "not stated"}</dd>
                <dt className="font-medium">Term</dt><dd className="text-secondary">{sum.term}</dd>
                <dt className="font-medium">Money</dt><dd className="text-secondary">{sum.money}</dd>
                <dt className="font-medium">Governing law</dt><dd className="text-secondary">{sum.governingLaw}</dd>
              </dl>
            </>
          ) : <p className="mt-2 text-ui-base text-secondary">The summary could not be prepared. The overall risk above comes from the clause results.</p>}
        </Panel>
      )}

      {clauses.length > 0 && (
        <section className="mt-6" aria-labelledby="rv-cl">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="rv-cl" className={H2}>Clauses ({clauses.length})</h2>
            <label className="flex items-center gap-2 text-ui-sm text-secondary"><input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Only clauses that need attention</label></div>
          <ul className="mt-3 space-y-3">
            {shown.map((c, i) => (
              <Panel as="li" key={i}>
                <p className="flex flex-wrap items-center gap-2"><strong className="text-ui-body font-semibold">{c.ref}</strong><Badge tone={CLAUSE_BADGE[c.risk].tone}>{CLAUSE_BADGE[c.risk].text}</Badge>{c.page ? <span className="text-ui-sm text-muted">Page {c.page}</span> : null}{c.scan ? <Badge tone="warn" title={SCAN_LABEL}>Read from scan</Badge> : null}</p>
                {c.quote && <blockquote className="mt-2 border-l-2 border-border pl-3 text-ui-base italic text-secondary">“{c.quote}”</blockquote>}
                <p className="mt-2 text-ui-base">{c.reason}</p>
              </Panel>
            ))}
          </ul>
        </section>
      )}

      {changes.length > 0 && (
        <section className="mt-6" aria-labelledby="rv-ch">
          <h2 id="rv-ch" className={H2}>Suggested changes</h2>
          <ul className="mt-3 space-y-3">
            {changes.map((c, i) => (
              <Panel as="li" key={i}>
                <p className="flex flex-wrap items-center gap-2"><strong className="text-ui-body font-semibold">Clause {c.ref}</strong><Badge tone={CLAUSE_BADGE[c.risk].tone}>{CLAUSE_BADGE[c.risk].text}</Badge></p>
                <p className="mt-2 text-ui-sm font-semibold uppercase tracking-[0.08em] text-muted">Proposed wording</p>
                <p className="mt-1 whitespace-pre-wrap rounded-panel bg-accent px-3 py-2 text-ui-base">{c.change!.wording}</p>
                <p className="mt-2 text-ui-base text-secondary"><strong className="font-medium text-foreground">Why: </strong>{c.change!.why}</p>
              </Panel>
            ))}
          </ul>
        </section>
      )}

      {res.missing.length > 0 && (
        <Panel as="section" className="mt-6" aria-labelledby="rv-mi">
          <h2 id="rv-mi" className={H2}>Usually found in this kind of contract, but missing here</h2>
          <ul className="mt-3 space-y-2">{res.missing.map((m, i) => <li key={i} className="text-ui-base"><strong className="font-medium">{m.clause}.</strong> <span className="text-secondary">{m.why}</span></li>)}</ul>
        </Panel>
      )}

      {res.law.status === "ok" && (
        <section className="mt-6" aria-labelledby="rv-law">
          <h2 id="rv-law" className={H2}>Indian law points</h2>
          <p className="mt-1 text-ui-sm text-muted">Only points backed by an Act section or a judgment excerpt we retrieved are shown; each links to its source.{(res.law.dropped ?? 0) > 0 ? ` ${res.law.dropped} possible point${res.law.dropped === 1 ? " was" : "s were"} left out because no retrieved section supported ${res.law.dropped === 1 ? "it" : "them"}.` : ""}</p>
          {(res.law.findings ?? []).length === 0 ? <Notice tone="info" compact className="mt-3"><p>No law points were supported by the sections found.</p></Notice> : (
            <ul className="mt-3 space-y-3">
              {res.law.findings!.map((f, i) => (
                <Panel as="li" key={i}>
                  <p className="flex flex-wrap items-center gap-2"><strong className="text-ui-body font-semibold">{f.topic}</strong>{f.clause && <span className="text-ui-sm text-muted">clause {f.clause}</span>}<Badge tone={f.severity === "issue" ? "bad" : "warn"}>{f.severity === "issue" ? "Possible issue" : "To check"}</Badge></p>
                  <p className="mt-2 text-ui-base leading-relaxed"><CitedText text={f.text} sources={sources} /></p>
                </Panel>
              ))}
            </ul>
          )}
        </section>
      )}
      {done && run.status !== "failed" && <FeedbackBar feature="review" itemId={run.id} className="mt-8" />}
      {done && <p className="mt-4 text-ui-sm text-muted">{NOT_LEGAL_ADVICE} Models used: {res.models.length ? res.models.join(", ") : "none"}.</p>}
    </div>
  );
}
