"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Panel } from "@/components/kit";
import { routes } from "@/lib/routes.mjs";

// "Recent work" on Desk: your last chats, drafts and reviews, newest first, from the three lists that already exist. Presentation and three reads; nothing here searches or writes.
type Item = { id: string; kind: "Ask" | "Draft" | "Review"; title: string; at: string; href: string; note?: string };
type J = Record<string, unknown>;
const get = async (url: string): Promise<J> => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : {}; } catch { return {}; } };
const rs = (x: unknown) => (Array.isArray(x) ? (x as J[]) : []);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const RISK: Record<string, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

export default function RecentWork() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    Promise.all([get("/api/chat"), get("/api/drafting"), get("/api/review")]).then(([c, d, r]) => {
      const all: Item[] = [
        ...rs(c.chats).map((x) => ({ id: `c${x.id}`, kind: "Ask" as const, title: String(x.title ?? "Untitled question"), at: String(x.updatedAt ?? ""), href: routes.ask(String(x.id)) })),
        ...rs(d.drafts).map((x) => ({ id: `d${x.id}`, kind: "Draft" as const, title: String(x.title ?? "Draft"), at: String(x.updatedAt ?? ""), href: routes.drafts(String(x.id)) })),
        ...rs(r.reviews).map((x) => ({ id: `r${x.id}`, kind: "Review" as const, title: String(x.docName ?? "Review"), at: String(x.createdAt ?? ""), href: routes.reviews(String(x.id)), note: RISK[String(x.risk)] })),
      ];
      setItems(all.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6));
    });
  }, []);
  return (
    <section aria-labelledby="recent" className="mt-10">
      <h2 id="recent" className="font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted">Recent work</h2>
      <Panel as="div" className="mt-2 px-card py-1">
        {items === null && <p className="py-4 text-ui-base text-muted">Loading…</p>}
        {items?.length === 0 && <p className="py-4 text-ui-base text-secondary">Nothing yet. Ask a question, write a draft or review a contract and it will show here. Saved on this browser only.</p>}
        {!!items?.length && (
          <ul className="divide-y divide-border/60">
            {items.map((x) => (
              <li key={x.id}><Link href={x.href} className="flex items-center gap-3 py-3 hover:text-primary focus-visible:outline-2">
                <Badge className="w-[4.5rem] shrink-0 justify-center">{x.kind}</Badge>
                <span className="min-w-0 flex-1"><span className="block truncate text-ui-body font-medium">{x.title}</span><span className="block text-ui-sm text-muted">{[x.note, when(x.at)].filter(Boolean).join(" · ")}</span></span>
              </Link></li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
