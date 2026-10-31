"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/kit";
import { routes } from "@/lib/routes.mjs";

// "Your recent questions" on the empty Ask page: the saved chats of THIS browser (the same list Desk shows as Recent work), newest first, each opening its conversation. Presentation and one read; nothing is written
// and nothing new is stored: the chats were already saved when they were asked. Colours, sizes and shapes come from the tokens through the shared kit.
type Chat = { id: string; title: string; updatedAt: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function RecentQuestions({ limit = 8 }: { limit?: number }) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const load = useCallback(() => { fetch("/api/chat", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { chats: [] })).then((j) => setChats(Array.isArray(j.chats) ? j.chats.slice(0, limit) : [])).catch(() => setChats([])); }, [limit]);
  useEffect(() => { load(); window.addEventListener("lb-chats-changed", load); return () => window.removeEventListener("lb-chats-changed", load); }, [load]);
  if (!chats?.length) return null;   // nothing saved on this browser yet: nothing to show
  return (
    <section aria-labelledby="recent-questions" className="mt-8" data-recent-questions>
      <h2 id="recent-questions" className="font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted">Your recent questions</h2>
      <Panel as="div" className="mt-2 px-card py-1">
        <ul className="divide-y divide-border/60">
          {chats.map((c) => (
            <li key={c.id}><Link href={routes.ask(c.id)} className="flex items-baseline justify-between gap-3 py-3 hover:text-primary focus-visible:outline-2">
              <span className="min-w-0 truncate text-ui-body font-medium">{c.title}</span><span className="shrink-0 text-ui-sm text-muted">{when(c.updatedAt)}</span>
            </Link></li>
          ))}
        </ul>
      </Panel>
      <p className="mt-2 text-ui-sm text-muted">Saved on this browser only.</p>
    </section>
  );
}
