"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/kit";
import { routes } from "@/lib/routes.mjs";

// "Your recent questions" on the empty Ask page: the questions asked on THIS browser, newest first, each opening the conversation it belongs to. Presentation and one read (/api/chat?questions=1, which reads the
// chats that were already saved); nothing is written and nothing new is stored. Colours, sizes and shapes come from the tokens through the shared kit.
type Q = { id: number; chatId: string; question: string; at: string };
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function RecentQuestions() {
  const [qs, setQs] = useState<Q[] | null>(null), [failed, setFailed] = useState(false);
  const load = useCallback(() => { fetch("/api/chat?questions=1", { cache: "no-store" }).then((r) => { setFailed(!r.ok); return r.ok ? r.json() : { questions: [] }; }).then((j) => setQs(Array.isArray(j.questions) ? j.questions : [])).catch(() => { setFailed(true); setQs([]); }); }, []);
  useEffect(() => { load(); window.addEventListener("lb-chats-changed", load); return () => window.removeEventListener("lb-chats-changed", load); }, [load]);
  if (failed) return <p role="status" className="mt-6 text-ui-sm text-muted" data-recent-questions-error>Your recent questions could not be loaded just now.</p>;   // said, never silently empty
  if (!qs?.length) return null;   // nothing asked on this browser yet: nothing to show
  return (
    <section aria-labelledby="recent-questions" className="mt-6" data-recent-questions>
      <h2 id="recent-questions" className="font-mono text-fs-nano font-medium uppercase tracking-caps-wide text-muted">Your recent questions</h2>
      <Panel as="div" className="mt-2 px-card py-1">
        <ul className="divide-y divide-border/60">
          {qs.map((x) => (
            <li key={x.id}><Link href={routes.ask(x.chatId)} className="flex items-baseline justify-between gap-3 py-3 hover:text-primary focus-visible:outline-2">
              <span className="min-w-0 truncate text-ui-body font-medium">{x.question}</span><span className="shrink-0 text-ui-sm text-muted">{when(x.at)}</span>
            </Link></li>
          ))}
        </ul>
      </Panel>
      <p className="mt-2 text-ui-sm text-muted">Saved on this browser only. Questions asked in one conversation open that conversation.</p>
    </section>
  );
}
