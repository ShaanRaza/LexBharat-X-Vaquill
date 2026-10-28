"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { routes, SUPREME_COURT } from "@/lib/routes.mjs";
import { MIN_CHARS, groupOrder, matchWork } from "@/lib/shell/quickfind.mjs";

// Quick-find's data: laws (exact-word search, never by meaning), Supreme Court judgments by party name or citation, and your own chats, drafts, reviews and documents (matched in the browser).
// Logic only; the dialog decides how it looks. Typing never calls Voyage: /api/acts/search is always asked for exact=1.
export type QfItem = { id: string; title: string; sub?: string; href: string; kind: string };
export type QfGroups = { laws: QfItem[]; judgments: QfItem[]; work: QfItem[] };
const EMPTY: QfGroups = { laws: [], judgments: [], work: [] };
type J = Record<string, unknown>;
const list = async (url: string): Promise<J> => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : {}; } catch { return {}; } };

export function useQuickFind(open: boolean, q: string) {
  const [mine, setMine] = useState<QfItem[] | null>(null), [laws, setLaws] = useState<QfItem[]>([]), [judgments, setJudgments] = useState<QfItem[]>([]), [busy, setBusy] = useState(false), seq = useRef(0);
  const query = q.replace(/\s+/g, " ").trim();
  // your own work: loaded once each time the box opens
  useEffect(() => {
    if (!open) return; let alive = true;
    Promise.all([list("/api/chat"), list("/api/drafting"), list("/api/review"), list("/api/vault")]).then(([c, d, r, v]) => {
      if (!alive) return;
      const a = (x: unknown) => (Array.isArray(x) ? (x as J[]) : []);
      setMine([
        ...a(c.chats).map((x) => ({ id: `c${x.id}`, title: String(x.title ?? "Chat"), sub: "Ask", href: routes.ask(String(x.id)), kind: "Ask", updatedAt: String(x.updatedAt ?? "") })),
        ...a(d.drafts).map((x) => ({ id: `d${x.id}`, title: String(x.title ?? "Draft"), sub: "Draft", href: routes.drafts(String(x.id)), kind: "Draft", updatedAt: String(x.updatedAt ?? "") })),
        ...a(r.reviews).map((x) => ({ id: `r${x.id}`, title: String(x.docName ?? "Review"), sub: "Review", href: routes.reviews(String(x.id)), kind: "Review", updatedAt: String(x.createdAt ?? "") })),
        ...a(v.docs).map((x) => ({ id: `v${x.id}`, title: String(x.name ?? "Document"), sub: "Document", href: routes.documents(String(x.id)), kind: "Document", updatedAt: String(x.createdAt ?? "") })),
      ] as QfItem[]);
    });
    return () => { alive = false; };
  }, [open]);
  // laws and judgments: after a short pause in typing
  useEffect(() => {
    if (!open || query.length < MIN_CHARS) { setLaws([]); setJudgments([]); setBusy(false); return; }
    const mySeq = ++seq.current, ac = new AbortController(); setBusy(true);
    const t = setTimeout(async () => {
      const [a, j] = await Promise.all([list(`/api/acts/search?q=${encodeURIComponent(query)}&exact=1`), list(`/api/judgments/search?q=${encodeURIComponent(query)}&pageSize=5`)]);
      if (mySeq !== seq.current || ac.signal.aborted) return;
      const rs = (x: unknown) => (Array.isArray(x) ? (x as J[]) : []);
      setLaws(rs(a.results).slice(0, 5).map((h) => ({ id: `l${h.actId}${h.sectionKey}`, title: `${h.number ? `Section ${h.number} · ` : ""}${h.actTitle}`, sub: h.heading ? String(h.heading) : undefined, href: routes.law(String(h.actId), String(h.sectionKey)), kind: "Law" })));
      setJudgments(rs(j.results).slice(0, 5).map((c) => ({ id: `j${c.caseId}`, title: String(c.title), sub: [c.citation, c.year].filter(Boolean).join(" · "), href: routes.judgment(SUPREME_COURT, String(c.year), String(c.caseId)), kind: "Judgment" })));
      setBusy(false);
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [open, query]);
  const groups: QfGroups = useMemo(() => (query.length < MIN_CHARS ? EMPTY : { laws, judgments, work: matchWork(mine ?? [], query) as QfItem[] }), [query, laws, judgments, mine]);
  return { groups, order: groupOrder(query) as (keyof QfGroups)[], busy, ready: query.length >= MIN_CHARS };
}
