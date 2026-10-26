"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import workspace from "@/config/workspace.json";

// The Legal Workspace dashboard (/workspace): quick actions, this browser's recent chats, and an honest list of what works today. Presentation and one fetch; no search or chat logic here.
type Chat = { id: string; title: string; updatedAt: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Action({ title, text, href }: { title: string; text: string; href?: string }) {
  const body = <><span className="block text-ui-body font-medium">{title}{!href && <Badge className="ml-2 align-middle">Coming soon</Badge>}</span><span className="mt-1 block text-ui-base text-secondary">{text}</span></>;
  return href
    ? <Link href={href} className="block rounded-card bg-surface p-card shadow-sm ring-1 ring-control-border/60 transition-colors hover:bg-accent/50 focus-visible:outline-2">{body}</Link>
    : <div role="link" aria-disabled="true" className="block cursor-not-allowed rounded-card bg-surface/60 p-card text-muted ring-1 ring-border/40">{body}</div>;
}

const LIVE = ["Acts search: by words, by “exact phrase”, or a section lookup like “138 NI Act”", "Smart search (by meaning) over Central and State Acts", "Chat: plain-English answers from Act sections, with a link to each section used", "Drafting: five templates (cheque-bounce notice, legal notice, NDA, rent agreement, service agreement) grounded in the Acts",
  "Vault: keep PDF, Word and text files, and scanned pages or photos, on this browser, and attach them to a chat question (answers cite the document page and the Act section)",
  "Review: upload a contract for a summary, clause risks, suggested wording, missing clauses and Indian-law points tied to Act sections",
  "Supreme Court judgments: the full text on each case page, search inside it (by meaning or by words), and short excerpts cited in Chat and Review",
  "Regulator instruments (RBI, SEBI, MCA and others), Law Commission reports: text and search"];
const SOON = ["High Court judgment text (case lists only today)", "Tribunal decisions"];

export default function WorkspaceDashboard() {
  const [chats, setChats] = useState<Chat[] | null>(null);
  useEffect(() => { fetch("/api/chat", { cache: "no-store" }).then((r) => r.json()).then((j) => setChats(j.chats ?? [])).catch(() => setChats([])); }, []);
  const f = workspace.features;
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Testing phase:</strong> don&apos;t enter confidential client information.</p></Notice>
      <h1 className="mt-6 text-ui-title font-semibold">Welcome to LexBharat</h1>
      <p className="mt-2 text-ui-body text-secondary">Research Indian law in plain English, with a link to the section behind every answer.</p>

      <section aria-labelledby="quick" className="mt-8">
        <h2 id="quick" className="text-ui-lead font-semibold">Start here</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Action href="/workspace/chat" title="Ask a legal question" text="Get an answer from Indian Acts, with numbered citations." />
          <Action href="/workspace/browse" title="Search Acts & Judgments" text="Look up an Act or a section, or browse Supreme Court and High Court cases." />
          <Action href={f.drafting.enabled ? f.drafting.href : undefined} title={f.drafting.action} text="Prepare a first draft from a template, with the Acts it relies on." />
          <Action href={f.review.enabled ? f.review.href : undefined} title={f.review.action} text="Check a contract against the law and flag problems." />
          <Action href={f.vault.enabled ? f.vault.href : undefined} title={f.vault.action} text="Keep your own documents here and use them in chat and review." />
        </div>
      </section>

      <section aria-labelledby="recent" className="mt-8">
        <h2 id="recent" className="text-ui-lead font-semibold">Recent chats</h2>
        <Panel as="div" className="mt-3 px-card py-3">
          {chats === null && <p className="text-ui-base text-muted">Loading…</p>}
          {chats?.length === 0 && (
            <div className="py-3 text-center">
              <p className="text-ui-base text-secondary">No chats on this browser yet.</p>
              <Link href="/workspace/chat" className="mt-3 inline-flex min-h-10 items-center rounded-button bg-primary px-4 text-ui-base font-medium text-on-primary hover:bg-primary-hover">Start a chat</Link>
            </div>
          )}
          {!!chats?.length && (
            <ul className="divide-y divide-border/60">
              {chats.slice(0, 5).map((c) => <li key={c.id}><Link href={`/workspace/chat/${c.id}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:text-primary"><span className="min-w-0 truncate text-ui-base">{c.title}</span><span className="shrink-0 text-ui-sm text-muted">{when(c.updatedAt)}</span></Link></li>)}
            </ul>
          )}
          <p className="mt-2 text-ui-sm text-muted">Your chats are saved on this browser only.</p>
        </Panel>
      </section>

      <section aria-labelledby="status" className="mt-8">
        <h2 id="status" className="text-ui-lead font-semibold">What works today</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Panel as="div"><h3 className="flex items-center gap-2 text-ui-base font-semibold"><Badge tone="complete">Live now</Badge></h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ui-base text-secondary">{LIVE.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
          <Panel as="div"><h3 className="flex items-center gap-2 text-ui-base font-semibold"><Badge>Not yet</Badge></h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ui-base text-secondary">{SOON.map((x) => <li key={x}>{x}</li>)}</ul></Panel>
        </div>
        <p className="mt-3 text-ui-sm text-muted">Chat and Review search Indian Acts and Supreme Court judgment excerpts. Not legal advice.</p>
      </section>
    </div>
  );
}
