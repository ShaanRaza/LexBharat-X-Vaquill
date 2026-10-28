"use client";
import { useEffect, useState } from "react";
import qcfg from "@/config/quickfind.json";
import { unitReadable, type QfConfig } from "@/lib/quickfind/rank.mjs";
import { routes, SUPREME_COURT } from "@/lib/routes.mjs";
import { classifyDesk, norm, type DeskKind } from "@/lib/shell/desk.mjs";

// Desk's box: what the typed text means, and where Enter goes. Citations and case names are looked up (the same exact-word search as Quick-find, never a search by meaning) so the box can say WHAT it will open.
// Logic only; the box decides how it looks.
export type DeskTarget = { href: string; title: string };
type J = Record<string, unknown>;
const get = async (url: string): Promise<J> => { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : {}; } catch { return {}; } };
const rs = (x: unknown) => (Array.isArray(x) ? (x as J[]) : []);

/** Looks up the page a citation or a case name points at. null when nothing matched (the box then searches). */
export async function resolveDesk(q: string, kind: DeskKind): Promise<DeskTarget | null> {
  const s = norm(q);
  if (kind === "law") {
    const qf = await get(`/api/quickfind?q=${encodeURIComponent(s)}`), l = rs(qf.laws)[0];
    if (l) return { href: routes.law(String(l.actId), String(l.sectionKey)), title: `${l.number ? `${unitReadable(String(l.number))} · ` : ""}${l.actTitle}` };
    const a = await get(`/api/acts/search?q=${encodeURIComponent(s)}&exact=1`), h = a.mode === "lookup" ? rs(a.results)[0] : undefined;   // Orders and Articles: "Order 7 Rule 11", "Article 21 Constitution"
    return h ? { href: routes.law(String(h.actId), String(h.sectionKey)), title: `${h.number ? `${unitReadable(String(h.number))} · ` : ""}${h.actTitle}` } : null;
  }
  if (kind === "case") {   // a case name opens the judgment only when exactly one case matches; several matches mean we are not sure which, so the box searches judgments instead
    const js = rs((await get(`/api/quickfind?q=${encodeURIComponent(s)}`)).judgments), c = js.length === 1 ? js[0] : undefined;
    return c ? { href: routes.judgment(SUPREME_COURT, String(c.year), String(c.caseId)), title: String(c.title) } : null;
  }
  return null;
}

/** Where Enter goes for this text. */
export function deskHref(kind: DeskKind, q: string, target: DeskTarget | null): string {
  const s = norm(q);
  if (kind === "ask") return routes.askQuestion(s);
  if (kind === "law") return target?.href ?? routes.searchPage(s);
  if (kind === "case") return target?.href ?? routes.library(s);
  return routes.searchPage(s);
}

export function useDeskBox(q: string) {
  const kind = classifyDesk(q, qcfg as QfConfig).kind, text = norm(q), [target, setTarget] = useState<DeskTarget | null>(null);
  useEffect(() => {
    setTarget(null); if (kind !== "law" && kind !== "case") return;
    let alive = true; const t = setTimeout(() => { resolveDesk(text, kind).then((x) => alive && setTarget(x)); }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [kind, text]);
  return { kind, target, text };
}
