"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import cfg from "@/config/quickfind.json";
import { parseQuick, unitReadable, type QfConfig } from "@/lib/quickfind/rank.mjs";
import { routes, SUPREME_COURT } from "@/lib/routes.mjs";
import workspace from "@/config/workspace.json";
import { MIN_CHARS, groupOrder, matchShortcuts, matchWork } from "@/lib/shell/quickfind.mjs";

// Quick-find's data. Laws: for a number ("138", "43A", "138 NI", "NI 138") the sections and Articles NUMBERED that, best-known first (/api/quickfind), then a separate group of sections that only MENTION it
// (exact-word search); for words, the exact-word matches. Judgments: Supreme Court cases by party name or case number, never by a report page number. Your own chats, drafts, reviews and documents are matched in
// the browser. Logic only; the dialog decides how it looks. Typing never calls Voyage: /api/acts/search is always asked for exact=1.
export type QfItem = { id: string; title: string; sub?: string; href: string; kind: string };
export type QfGroups = { go: QfItem[]; laws: QfItem[]; mentions: QfItem[]; judgments: QfItem[]; work: QfItem[] };
const EMPTY: QfGroups = { go: [], laws: [], mentions: [], judgments: [], work: [] };
const PAGE: Record<string, { href: string; sub: string }> = { drafts: { href: routes.drafts(), sub: "Your drafts, and a new draft" }, reviews: { href: routes.reviews(), sub: "Contract reviews, and a new one" }, vault: { href: routes.vault(), sub: "Your documents" } };
const ON = Object.entries(workspace.features).filter(([, f]) => f.enabled).map(([k]) => k);   // the pages switched on in src/config/workspace.json
type J = Record<string, unknown>;
const list = async (url: string): Promise<J> => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : {}; } catch { return {}; } };
const rs = (x: unknown) => (Array.isArray(x) ? (x as J[]) : []);
const lawItem = (h: J, kind = "Law"): QfItem => ({
  id: `l${h.actId}${h.sectionKey}`, title: `${h.number ? `${unitReadable(String(h.number))} · ` : ""}${h.actTitle}`,
  sub: [h.actStatus === "repealed" ? "Repealed" : null, h.heading ? String(h.heading) : null].filter(Boolean).join(" · ") || undefined, href: routes.law(String(h.actId), String(h.sectionKey)), kind,
});

export function useQuickFind(open: boolean, q: string) {
  const [mine, setMine] = useState<QfItem[] | null>(null), [laws, setLaws] = useState<QfItem[]>([]), [mentions, setMentions] = useState<QfItem[]>([]), [judgments, setJudgments] = useState<QfItem[]>([]), [busy, setBusy] = useState(false), seq = useRef(0);
  const query = q.replace(/\s+/g, " ").trim(), parsed = useMemo(() => parseQuick(query, cfg as QfConfig), [query]);
  // your own work: loaded once each time the box opens
  useEffect(() => {
    if (!open) return; let alive = true;
    Promise.all([list("/api/chat"), list("/api/drafting"), list("/api/review"), list("/api/vault")]).then(([c, d, r, v]) => {
      if (!alive) return;
      setMine([
        ...rs(c.chats).map((x) => ({ id: `c${x.id}`, title: String(x.title ?? "Chat"), sub: "Ask", href: routes.ask(String(x.id)), kind: "Ask", updatedAt: String(x.updatedAt ?? "") })),
        ...rs(d.drafts).map((x) => ({ id: `d${x.id}`, title: String(x.title ?? "Draft"), sub: "Draft", href: routes.drafts(String(x.id)), kind: "Draft", updatedAt: String(x.updatedAt ?? "") })),
        ...rs(r.reviews).map((x) => ({ id: `r${x.id}`, title: String(x.docName ?? "Review"), sub: "Review", href: routes.reviews(String(x.id)), kind: "Review", updatedAt: String(x.createdAt ?? "") })),
        ...rs(v.docs).map((x) => ({ id: `v${x.id}`, title: String(x.name ?? "Document"), sub: "Document", href: routes.vault(String(x.id)), kind: "Document", updatedAt: String(x.createdAt ?? "") })),
      ] as QfItem[]);
    });
    return () => { alive = false; };
  }, [open]);
  // laws and judgments: after a short pause in typing
  useEffect(() => {
    if (!open || query.length < MIN_CHARS) { setLaws([]); setMentions([]); setJudgments([]); setBusy(false); return; }
    const mySeq = ++seq.current, ac = new AbortController(); setBusy(true);
    const t = setTimeout(async () => {
      const wantText = parsed.kind !== "act-number";   // "138 NI" names one Act: the words "138 NI" would only match noise
      const [qf, text] = await Promise.all([list(`/api/quickfind?q=${encodeURIComponent(query)}`), wantText ? list(`/api/acts/search?q=${encodeURIComponent(query)}&exact=1`) : Promise.resolve({} as J)]);
      if (mySeq !== seq.current || ac.signal.aborted) return;
      const numbered = rs(qf.laws).map((h) => lawItem(h)), textHits = rs(text.results).slice(0, 8).map((h) => lawItem(h));
      if (parsed.kind === "text") { setLaws(textHits.slice(0, 5)); setMentions([]); }
      else { const seen = new Set(numbered.map((x) => x.id)); setLaws(numbered); setMentions(textHits.filter((x) => !seen.has(x.id)).slice(0, 5).map((x) => ({ ...x, kind: "Mention" }))); }
      setJudgments(rs(qf.judgments).map((c) => ({ id: `j${c.caseId}`, title: String(c.title), sub: [c.caseNumber, c.citation, c.year].filter(Boolean).join(" · "), href: routes.judgment(SUPREME_COURT, String(c.year), String(c.caseId)), kind: "Judgment" })));
      setBusy(false);
    }, 250);
    return () => { clearTimeout(t); ac.abort(); };
  }, [open, query, parsed.kind]);
  const groups: QfGroups = useMemo(() => (query.length < MIN_CHARS ? EMPTY : { go: matchShortcuts(query, ON).map((x) => ({ id: `g${x.id}`, title: x.label, sub: PAGE[x.id].sub, href: PAGE[x.id].href, kind: "Page" })), laws, mentions, judgments, work: matchWork(mine ?? [], query) as QfItem[] }), [query, laws, mentions, judgments, mine]);
  return { groups, order: groupOrder(query, parsed.kind !== "text") as (keyof QfGroups)[], busy, ready: query.length >= MIN_CHARS, mentionsLabel: parsed.kind === "number" ? `Mentions ${parsed.number}` : "Mentions" };
}
