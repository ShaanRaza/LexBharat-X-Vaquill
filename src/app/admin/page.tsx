// /admin: usage by day, thumbs up/down per feature, and every thumbs-down with its question, answer and comment. Needs the admin password (ADMIN_PASSWORD, different from the access password).
// Data: Supabase tables from scripts/w8/w8-schema.sql. No IP addresses and no document text are stored; browsers appear only as hashes (and not at all on this page).
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Badge, Notice, Panel } from "@/components/kit";
import AdminLogin from "@/components/AdminLogin";
import AdminLogout from "@/components/AdminLogout";
import { ADMIN_COOKIE, adminState, isAdminCookie } from "@/lib/insights/admin";
import { adminMessages, adminData, adminGaps, insightsConfigured } from "@/lib/insights/server";
import config from "@/config/ai-models.json";
import { creditStatus } from "@/lib/ai/guard.mjs";
import { byDay, ratio, topGaps } from "@/lib/insights/rules.mjs";

export const metadata: Metadata = { title: "Insights | LexBharat", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FEATURE_NAMES: Record<string, string> = { chat: "Ask answers", draft: "Drafts", review: "Reviews" };
const th = "px-3 py-2 text-left font-medium";
const td = "px-3 py-2 align-top";
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function InsightsPage() {
  const a = adminState(), jar = await cookies(), ok = await isAdminCookie(jar.get(ADMIN_COOKIE)?.value);
  const shell = (children: React.ReactNode) => <main id="main" className="mx-auto max-w-5xl px-4 py-8">{children}</main>;
  if (a.state !== "ready") {
    return shell(<><h1 className="text-ui-title font-semibold">Insights</h1>
      <Notice tone="warn" role="note" className="mt-4"><p>{a.state === "same_as_access" ? "ADMIN_PASSWORD is the same as ACCESS_PASSWORD, so this page stays closed. Set a different ADMIN_PASSWORD in .env.local and restart." : a.state === "no_secret" ? "ACCESS_COOKIE_SECRET (at least 32 characters) is needed before the admin page can open." : "This page is closed until ADMIN_PASSWORD is set in .env.local."}</p></Notice></>);
  }
  if (!ok) return shell(<><h1 className="text-ui-title font-semibold">Insights</h1><p className="mt-2 text-ui-body text-secondary">Enter the admin password to continue.</p><AdminLogin /></>);

  if (!insightsConfigured()) return shell(<><h1 className="text-ui-title font-semibold">Insights</h1><Notice tone="warn" className="mt-4"><p>Supabase is not configured, so nothing is stored yet.</p></Notice></>);
  const d = await adminData(30).catch(() => null);
  if (!d || d.error) {
    return shell(<><h1 className="text-ui-title font-semibold">Insights</h1><Notice tone="warn" role="status" className="mt-4"><p>{d?.error === "missing" ? "The W8 tables are not in Supabase yet. Paste scripts/w8/w8-schema.sql into Supabase's SQL Editor and press Run, then reload." : "The statistics could not be loaded. Try again in a moment."}</p></Notice></>);
  }
  const credit = config.spendGuard?.provider ? await creditStatus({ config, env: process.env as Record<string, string | undefined>, force: true }) : null;
  const msgs = await adminMessages().catch(() => ({ error: "failed" as const, rows: [] }));
  const gapData = await adminGaps(30).catch(() => ({ error: "failed" as const, rows: [] })), gaps = topGaps(gapData.rows);   // sections testers hit that we do not hold, and "not found" questions: these drive the next downloads
  const days = byDay(d.usage), pages: Record<string, number> = {}, templates: Record<string, number> = {};
  for (const x of days) { for (const [k, v] of Object.entries(x.visitsByPage)) pages[k] = (pages[k] ?? 0) + v; for (const [k, v] of Object.entries(x.draftsByTemplate)) templates[k] = (templates[k] ?? 0) + v; }
  const tot = (f: (x: (typeof days)[number]) => number) => days.reduce((s, x) => s + f(x), 0), answers = tot((x) => x.answers), ms = tot((x) => x.answerMs);
  const votes = ["chat", "draft", "review"].map((f) => ({ f, ...ratio(d.votes.filter((v) => v.feature === f && v.vote === "up").length, d.votes.filter((v) => v.feature === f && v.vote === "down").length) }));
  return shell(
    <>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-ui-title font-semibold">Insights</h1><div className="flex gap-2"><a href="/api/admin/feedback-csv" className="inline-flex min-h-9 items-center rounded-panel bg-primary px-3 text-ui-sm font-medium text-on-primary">Download feedback (CSV)</a><AdminLogout /></div></div>
      <p className="mt-1 text-ui-sm text-secondary">Last 30 days, India dates. Counts only, except the gap log below (question text for a missing section or a "not found" answer): no IP addresses and no document text are stored.</p>
      {credit && <Notice tone={credit.tripped ? "warn" : "info"} role="status" className="mt-4"><p><strong>AI spend guard:</strong> {!credit.checked ? `credit could not be read (${credit.reason}); the paid route stays on.` : credit.tripped ? `PAUSED. The ${credit.provider} key has $${credit.remaining?.toFixed(2)} left (limit $${credit.limit}), below $${credit.minRemaining?.toFixed(2)}, so everything uses free Gemini.` : `paid route on. The ${credit.provider} key has ${credit.remaining == null ? "no spending limit" : `$${credit.remaining.toFixed(2)} left of $${credit.limit}`}; it pauses below $${credit.minRemaining?.toFixed(2)}.`}</p></Notice>}

      <Panel className="mt-5 p-0">
        <h2 className="px-card pt-card text-ui-lead font-semibold">By day</h2>
        <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Usage by day, scrollable table">
          <table className="w-full min-w-[720px] border-collapse text-ui-sm">
            <thead className="bg-accent text-secondary"><tr>{["Day", "Visits", "Questions asked", "Drafts", "Reviews", "Uploads", "Scans read", "Limits hit", "Model busy", "Avg answer (s)"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {days.length === 0 && <tr><td colSpan={10} className="px-3 py-4 text-muted">Nothing counted yet.</td></tr>}
              {days.map((x) => <tr key={x.day} className="border-t border-border/70"><th scope="row" className={`${td} whitespace-nowrap font-medium`}>{x.day}</th><td className={td}>{x.visits}</td><td className={td}>{x.chats}</td><td className={td}>{x.drafts}</td><td className={td}>{x.reviews}</td><td className={td}>{x.uploads}</td><td className={td}>{x.scans}</td><td className={td}>{x.limits}</td><td className={td}>{x.busy}</td><td className={td}>{x.avgAnswerSec ?? "–"}</td></tr>)}
              {days.length > 0 && <tr className="border-t-2 border-border bg-accent/50 font-medium"><th scope="row" className={td}>Total</th><td className={td}>{tot((x) => x.visits)}</td><td className={td}>{tot((x) => x.chats)}</td><td className={td}>{tot((x) => x.drafts)}</td><td className={td}>{tot((x) => x.reviews)}</td><td className={td}>{tot((x) => x.uploads)}</td><td className={td}>{tot((x) => x.scans)}</td><td className={td}>{tot((x) => x.limits)}</td><td className={td}>{tot((x) => x.busy)}</td><td className={td}>{answers ? Math.round(ms / answers / 100) / 10 : "–"}</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Panel><h2 className="text-ui-lead font-semibold">Visits by page</h2><ul className="mt-2 space-y-1 text-ui-base">{Object.entries(pages).sort((p, q) => q[1] - p[1]).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className="font-medium">{v}</span></li>)}{!Object.keys(pages).length && <li className="text-muted">None yet.</li>}</ul></Panel>
        <Panel><h2 className="text-ui-lead font-semibold">Drafts by template</h2><ul className="mt-2 space-y-1 text-ui-base">{Object.entries(templates).sort((p, q) => q[1] - p[1]).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className="font-medium">{v}</span></li>)}{!Object.keys(templates).length && <li className="text-muted">None yet.</li>}</ul></Panel>
      </div>

      <Panel className="mt-5">
        <h2 className="text-ui-lead font-semibold">Thumbs up / down (all time)</h2>
        <table className="mt-2 w-full text-ui-base"><thead className="text-left text-ui-sm text-secondary"><tr><th scope="col" className="py-1 pr-3 font-medium">Feature</th><th scope="col" className="py-1 pr-3 font-medium">👍</th><th scope="col" className="py-1 pr-3 font-medium">👎</th><th scope="col" className="py-1 font-medium">Share 👍</th></tr></thead>
          <tbody>{votes.map((v) => <tr key={v.f} className="border-t border-border/70"><th scope="row" className="py-1.5 pr-3 text-left font-medium">{FEATURE_NAMES[v.f]}</th><td className="pr-3">{v.up}</td><td className="pr-3">{v.down}</td><td>{v.upPct === null ? "–" : `${v.upPct}%`}</td></tr>)}</tbody></table>
      </Panel>

      <section aria-labelledby="gaps" className="mt-6">
        <h2 id="gaps" className="text-ui-lead font-semibold">Gaps testers hit ({gaps.total} logged, last 30 days)</h2>
        <p className="mt-1 text-ui-sm text-secondary">Sections the library does not hold that a question or an answer named, and questions that came back &ldquo;not found&rdquo;. Download these Acts first (docs/PDF-DOWNLOAD-LIST.md). Nothing is logged for a question with a Vault document attached, and no browser id is stored.</p>
        {gapData.error === "missing" && <Notice tone="warn" role="status" className="mt-2"><p>The gap log table is not in Supabase yet. Paste scripts/w8/w8c-gap-log.sql into the Supabase SQL editor and run it.</p></Notice>}
        {gapData.error === "failed" && <Notice tone="warn" role="status" className="mt-2"><p>The gap log could not be loaded. Reload the page.</p></Notice>}
        {!gapData.error && gaps.total === 0 && <p className="mt-2 text-ui-base text-muted">Nothing logged yet.</p>}
        {gaps.sections.length > 0 && (
          <Panel className="mt-3 p-0"><h3 className="px-card pt-card text-ui-base font-semibold">Missing sections, most often first</h3>
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Missing sections, scrollable table"><table className="w-full min-w-[560px] border-collapse text-ui-sm">
              <thead className="bg-accent text-secondary"><tr>{["Times", "Act", "Section", "Latest question"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
              <tbody>{gaps.sections.map((g) => <tr key={`${g.act}|${g.section}`} className="border-t border-border/70"><td className={td}>{g.count}</td><td className={td}>{g.act}{g.unreliable && <Badge tone="warn" className="ml-1.5">scrambled text</Badge>}</td><td className={td}>{g.section}</td><td className={`${td} text-secondary`}>{g.lastQuestion}</td></tr>)}</tbody>
            </table></div></Panel>
        )}
        {gaps.notFound.length > 0 && (
          <Panel className="mt-3 p-0"><h3 className="px-card pt-card text-ui-base font-semibold">&ldquo;Not found&rdquo; questions, most often first</h3>
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Not found questions, scrollable table"><table className="w-full min-w-[560px] border-collapse text-ui-sm">
              <thead className="bg-accent text-secondary"><tr>{["Times", "Question", "Act named", "Section named"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
              <tbody>{gaps.notFound.map((g, i) => <tr key={i} className="border-t border-border/70"><td className={td}>{g.count}</td><td className={td}>{g.question}</td><td className={`${td} text-secondary`}>{g.act ?? "—"}</td><td className={`${td} text-secondary`}>{g.section ?? "—"}</td></tr>)}</tbody>
            </table></div></Panel>
        )}
      </section>

      <section aria-labelledby="messages" className="mt-6">
        <h2 id="messages" className="text-ui-lead font-semibold">Messages from the Feedback form ({msgs.rows.length}{msgs.rows.length >= 200 ? "+, newest 200" : ""})</h2>
        {msgs.error === "missing" && <Notice tone="warn" role="status" className="mt-2"><p>The messages table is not in Supabase yet. Paste scripts/w8/w8b-feedback-messages.sql into the Supabase SQL editor and run it once; the Feedback form works as soon as it exists.</p></Notice>}
        {msgs.error === "failed" && <Notice tone="warn" role="status" className="mt-2"><p>The messages could not be loaded. Reload the page.</p></Notice>}
        {!msgs.error && msgs.rows.length === 0 && <p className="mt-2 text-ui-base text-muted">No messages yet.</p>}
        <ul className="mt-3 space-y-3">
          {msgs.rows.map((m) => (
            <li key={m.id}><Panel as="article">
              <p className="flex flex-wrap items-center gap-1.5 text-ui-sm text-secondary">{m.page && <Badge>{m.page}</Badge>}{m.email && <Badge tone="info">{m.email}</Badge>}<span>{when(m.created_at)}</span></p>
              <p className="mt-2 whitespace-pre-wrap text-ui-base">{m.message}</p>
            </Panel></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="down" className="mt-6">
        <h2 id="down" className="text-ui-lead font-semibold">Thumbs-down feedback ({d.down.length}{d.down.length >= 300 ? "+, newest 300" : ""})</h2>
        {d.down.length === 0 && <p className="mt-2 text-ui-base text-muted">No thumbs-down yet.</p>}
        <ul className="mt-3 space-y-3">
          {d.down.map((r) => (
            <li key={r.id}><Panel as="article">
              <p className="flex flex-wrap items-center gap-1.5 text-ui-sm text-secondary"><Badge>{FEATURE_NAMES[r.feature] ?? r.feature}</Badge>{r.reasons.map((x) => <Badge key={x} tone="warn">{x}</Badge>)}<span>{when(r.updated_at)}</span>{r.model && <span>· {r.model}</span>}</p>
              {r.snapshot?.question && <p className="mt-2 text-ui-base"><span className="font-medium">Question: </span>{r.snapshot.question}</p>}
              {r.comment && <p className="mt-2 text-ui-base"><span className="font-medium">Comment: </span>{r.comment}</p>}
              {r.snapshot && !r.snapshot.question && <p className="mt-2 text-ui-sm text-secondary">{[r.snapshot.title, r.snapshot.template, r.snapshot.contractType, r.snapshot.side, r.snapshot.risk && `risk ${r.snapshot.risk}`].filter(Boolean).join(" · ")}</p>}
              {r.snapshot?.answer && <details className="mt-2"><summary className="min-h-8 cursor-pointer text-ui-sm text-primary">Answer and citations</summary><p className="mt-1 whitespace-pre-wrap text-ui-base">{r.snapshot.answer}</p>{!!r.snapshot.citations?.length && <p className="mt-1 text-ui-sm text-secondary">Cited: {r.snapshot.citations.join("; ")}</p>}</details>}
            </Panel></li>
          ))}
        </ul>
      </section>
    </>,
  );
}
