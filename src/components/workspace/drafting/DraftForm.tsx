"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import { formatAmount, formatDate, fieldVisible, validateInput } from "@/lib/drafting/templates.mjs";
import type { TemplateField } from "@/lib/drafting/templates.mjs";
import type { BasisItem } from "@/lib/drafting/store";
import { Checklist, LegalBasis } from "./DraftPanels";
import { readEvents } from "./ndjson";
import { useDraftingMeta } from "./useDraftingMeta";

// The template form and the live generation view: the sections are written one by one, the progress list shows where it is, and a section that fails does not stop the rest.
type Sec = { id: string; title: string; fixed: boolean; status: "waiting" | "writing" | "done" | "failed"; text: string };
const INPUT = "w-full rounded-input bg-surface px-3 py-2.5 text-ui-base text-foreground ring-1 ring-control-border focus-visible:outline-2";

function Field({ f, value, error, onChange }: { f: TemplateField; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `f-${f.key}`, hint = f.type === "amount" && value ? (formatAmount(value) ?? "Enter digits only, for example 250000.") : f.type === "date" && value ? (formatDate(value) ?? "Not a real date.") : f.hint;
  return (
    <div>
      <label htmlFor={id} className="block text-ui-base font-medium">{f.label}{f.required ? <span className="text-quality-bad" aria-label="required"> *</span> : <span className="text-muted"> (optional)</span>}</label>
      {f.type === "textarea" ? <textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1`} aria-invalid={!!error} />
        : f.type === "select" || f.type === "state" ? <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1`} aria-invalid={!!error}><option value="">Choose…</option>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        : <input id={id} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "amount" || f.type === "number" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1`} aria-invalid={!!error} />}
      {(error || hint) && <p className={`mt-1 text-ui-sm ${error ? "text-quality-bad" : "text-muted"}`}>{error || hint}</p>}
    </div>
  );
}

export default function DraftForm({ templateId }: { templateId: string }) {
  const router = useRouter(), { meta } = useDraftingMeta();
  const t = meta?.templates.find((x) => x.id === templateId);
  const [values, setValues] = useState<Record<string, string>>({}), [extra, setExtra] = useState(""), [email, setEmail] = useState(""), [allowMissing, setAllowMissing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}), [topErr, setTopErr] = useState("");
  const [phase, setPhase] = useState<"form" | "running" | "done">("form"), [secs, setSecs] = useState<Sec[]>([]), [basis, setBasis] = useState<BasisItem[]>([]), [basisNote, setBasisNote] = useState<string>();
  const [checklist, setChecklist] = useState<{ id: string; text: string }[]>([]), [notes, setNotes] = useState<string[]>([]), [draftId, setDraftId] = useState<string>(), [emailStatus, setEmailStatus] = useState<string>();

  if (!meta) return <p className="mx-auto max-w-4xl py-6 text-ui-base text-muted">Loading…</p>;
  if (!t) return <Notice tone="bad" role="alert" className="mx-auto mt-6 max-w-4xl"><p>That template was not found. <Link className="underline" href="/workspace/drafting">Back to Drafting</Link></p></Notice>;
  const visible = t.fields.filter((f) => fieldVisible(f as never, values));
  const groups = [...new Set(visible.map((f) => f.group ?? "Details"))];
  const set = (k: string, v: string) => { setValues((p) => ({ ...p, [k]: v })); setErrors((p) => { const { [k]: _, ...r } = p; return r; }); };

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setTopErr("");
    const local = validateInput(t as never, values).errors, onlyMissing = Object.values(local).every((m) => m === "Required.");
    if (Object.keys(local).length && !(allowMissing && onlyMissing)) { setErrors(local); setTopErr("Some details need fixing. They are marked below."); return; }
    setPhase("running"); setSecs([]); setBasis([]); setChecklist([]); setNotes([]); setDraftId(undefined); setEmailStatus(undefined);
    const patch = (id: string, f: (s: Sec) => Sec) => setSecs((p) => p.map((s) => (s.id === id ? f(s) : s)));
    try {
      const res = await fetch("/api/drafting/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateId, values, extra, email: email || undefined, allowMissing }) });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => ({})); if (j.errors) setErrors(j.errors); throw new Error(res.status === 401 ? "Your session ended. Reload and enter the access password again." : j.error || "Something went wrong."); }
      for await (const ev of readEvents<Record<string, any>>(res)) {
        if (ev.type === "plan") setSecs(ev.sections.map((s: { id: string; title: string; fixed: boolean }) => ({ ...s, status: "waiting", text: "" })));
        else if (ev.type === "basis") { setBasis(ev.basis); setBasisNote(ev.note); }
        else if (ev.type === "checklist") setChecklist(ev.items);
        else if (ev.type === "section_start") patch(ev.id, (s) => ({ ...s, status: "writing" }));
        else if (ev.type === "delta") patch(ev.id, (s) => ({ ...s, text: s.text + ev.text }));
        else if (ev.type === "section_done") patch(ev.id, (s) => ({ ...s, status: "done", text: ev.text }));
        else if (ev.type === "section_failed") patch(ev.id, (s) => ({ ...s, status: "failed", text: "" }));
        else if (ev.type === "saved") { setDraftId(ev.draftId); if (ev.basis) setBasis(ev.basis); }
        else if (ev.type === "email") setEmailStatus(ev.status);
        else if (ev.type === "error") throw new Error(ev.message);
      }
      window.dispatchEvent(new Event("lb-drafts-changed")); setPhase("done");
    } catch (err) { setTopErr((err as Error).message); setPhase("form"); }
  }

  if (phase !== "form") {
    const failed = secs.filter((s) => s.status === "failed").length;
    return (
      <div className="mx-auto max-w-5xl pb-10">
        <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Draft for review by a qualified lawyer. Not legal advice.</strong> Testing phase: don&apos;t enter confidential client information.</p></Notice>
        <h1 className="mt-5 text-ui-title font-semibold">{phase === "done" ? "Your draft is ready" : "Writing your draft…"}</h1>
        <p className="mt-1 text-ui-base text-secondary">{t.title}</p>
        {phase === "done" && draftId && <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" onClick={() => router.push(`/workspace/drafting/${draftId}`)} className="inline-flex min-h-10 items-center rounded-button bg-primary px-5 text-ui-base font-medium text-white hover:bg-primary-hover">Open the draft to edit and export</button>{failed > 0 && <Badge tone="warn">{failed} section{failed === 1 ? "" : "s"} not generated: retry in the editor</Badge>}{emailStatus && <Badge tone={emailStatus === "sent" ? "complete" : "warn"}>{emailStatus === "sent" ? "Email sent" : "Email could not be sent"}</Badge>}</div>}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            <Panel as="section" aria-label="Progress">
              <h2 className="text-ui-base font-semibold">Sections</h2>
              <ol className="mt-2 space-y-1.5" aria-live="polite">
                {secs.map((s) => <li key={s.id} className="flex items-center gap-2 text-ui-base"><span aria-hidden className={`inline-block size-2.5 rounded-full ${s.status === "done" ? "bg-quality-complete" : s.status === "writing" ? "animate-pulse bg-primary" : s.status === "failed" ? "bg-quality-bad" : "bg-border"}`} />
                  <span className={s.status === "waiting" ? "text-muted" : "text-foreground"}>{s.title}</span><span className="text-ui-sm text-muted">{s.status === "writing" ? "writing…" : s.status === "failed" ? "Not generated, retry in the editor" : s.status === "done" ? (s.fixed ? "standard text" : "done") : ""}</span></li>)}
                {!secs.length && <li className="text-ui-base text-muted">Preparing…</li>}
              </ol>
              {notes.map((n, i) => <p key={i} className="mt-2 text-ui-sm text-muted">{n}</p>)}
            </Panel>
            {secs.filter((s) => s.text).map((s) => <Panel as="article" key={s.id}><h3 className="text-ui-sm font-semibold uppercase tracking-caps text-muted">{s.title}</h3><div className="mt-1 whitespace-pre-wrap font-serif text-ui-body leading-relaxed">{s.text}{s.status === "writing" && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-muted align-middle" />}</div></Panel>)}
          </div>
          <div className="space-y-4">{(basis.length > 0 || phase === "done") && <LegalBasis basis={basis} note={basisNote} />}<Checklist items={checklist} /></div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={generate} className="mx-auto max-w-3xl pb-10" noValidate>
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Testing phase:</strong> don&apos;t enter confidential client information. Drafts are for review by a qualified lawyer and are not legal advice.</p></Notice>
      <p className="mt-5 text-ui-sm"><Link href="/workspace/drafting" className="text-primary underline">← All templates</Link></p>
      <h1 className="mt-2 text-ui-title font-semibold">{t.title}</h1>
      <p className="mt-2 text-ui-body text-secondary">{t.description}</p>
      {t.reliesOn.length > 0 && <p className="mt-2 text-ui-sm text-muted">Relies on: {t.reliesOn.map((r) => r.lookup).join(", ")} (the sections are retrieved and shown with the draft).</p>}
      {topErr && <Notice tone="bad" role="alert" className="mt-4"><p>{topErr}</p></Notice>}
      {groups.map((g) => (
        <fieldset key={g} className="mt-6 space-y-4 rounded-card bg-surface p-card ring-1 ring-border/60"><legend className="px-1 text-ui-sm font-semibold uppercase tracking-caps text-muted">{g}</legend>
          {visible.filter((f) => (f.group ?? "Details") === g).map((f) => <Field key={f.key} f={f as never} value={values[f.key] ?? ""} error={errors[f.key]} onChange={(v) => set(f.key, v)} />)}
        </fieldset>
      ))}
      <div className="mt-6 space-y-4 rounded-card bg-surface p-card ring-1 ring-border/60">
        <div><label htmlFor="extra" className="block text-ui-base font-medium">Extra instructions <span className="text-muted">(optional)</span></label>
          <textarea id="extra" rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={2000} className={`${INPUT} mt-1`} placeholder="Anything else the draft should say or take into account." /></div>
        {meta.emailAvailable && <div><label htmlFor="email" className="block text-ui-base font-medium">Email me when it&apos;s ready <span className="text-muted">(optional)</span></label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${INPUT} mt-1`} /><p className="mt-1 text-ui-sm text-muted">Used once to send the link, then forgotten: it is not stored.</p></div>}
        <label className="flex items-start gap-2 text-ui-sm text-secondary"><input type="checkbox" checked={allowMissing} onChange={(e) => setAllowMissing(e.target.checked)} className="mt-1" /><span>Generate even if some required details are missing. They will appear as highlighted placeholders such as <span className="draft-placeholder">[TENANT&apos;S ADDRESS]</span>.</span></label>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" className="min-h-11 rounded-button bg-primary px-6 text-ui-base font-medium text-white hover:bg-primary-hover">Generate draft</button>
        <span className="text-ui-sm text-muted">{meta.limits.daily} drafts a day, {meta.limits.weekly} a week. {Math.max(0, meta.limits.daily - meta.usage.day)} left today. It takes about a minute.</span>
      </div>
    </form>
  );
}
