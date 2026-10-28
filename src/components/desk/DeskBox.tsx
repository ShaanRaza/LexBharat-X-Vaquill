"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/kit";
import desk from "@/config/desk.json";
import { routes } from "@/lib/routes.mjs";
import { deskHint } from "@/lib/shell/desk.mjs";
import { deskHref, resolveDesk, useDeskBox } from "./useDesk";

// The one big box on Desk. What you type decides where Enter goes, and the line under the box always says which (a question opens Ask, a citation the law, a case name the judgment, anything else searches).
// Presentation only; the decision and the lookup are in useDesk and src/lib/shell/desk.mjs. Words come from src/config/desk.json.
const GO = { drafts: () => routes.drafts(), reviews: () => routes.reviews(), vault: () => routes.vault() } as const;

export default function DeskBox() {
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false), router = useRouter(), id = useId(), { kind, target, text } = useDeskBox(q);
  async function run(value: string) {
    const v = value.trim(); if (!v || busy) return;
    setBusy(true);
    const k = kind === "empty" ? "search" : kind;
    router.push(deskHref(k, v, k === "law" || k === "case" ? (target ?? await resolveDesk(v, k)) : null));
  }
  return (
    <div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex flex-col gap-2 rounded-card bg-surface p-2 ring-1 ring-control-border focus-within:ring-2 focus-within:ring-primary sm:flex-row sm:items-center sm:gap-3 sm:pl-5">
        <label htmlFor={`${id}-q`} className="sr-only">Ask a question, find a law, or paste a section</label>
        <input id={`${id}-q`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoFocus placeholder={desk.placeholder} aria-describedby={`${id}-hint`} className="h-12 min-w-0 flex-1 bg-transparent px-3 text-ui-base text-foreground outline-none placeholder:text-muted sm:px-0 sm:text-ui-lead" />
        <Button type="submit" variant="primary" size="lg" disabled={!text || busy} className="w-full sm:w-auto">{busy ? "Opening…" : "Go"}</Button>
      </form>
      <p id={`${id}-hint`} role="status" aria-live="polite" className="mt-2.5 min-h-5 text-ui-sm text-muted">{deskHint(kind, q, target, desk)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {desk.chips.map((c) => "go" in c && c.go
          ? <Button key={c.text} href={GO[c.go as keyof typeof GO]()} variant="secondary" size="sm">{c.text}</Button>
          : <Button key={c.text} variant="secondary" size="sm" onClick={() => { setQ(c.text); run(c.text); }}>{c.text}</Button>)}
      </div>
    </div>
  );
}
