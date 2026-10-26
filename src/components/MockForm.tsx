"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMockSession } from "@/lib/mockSession";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

export type Field = { name: string; label: string; type?: "text" | "email" | "textarea" | "select"; required?: boolean; options?: string[]; placeholder?: string };

/** Generic form that posts to /api/mock/forms/<kind>. Nothing is stored or sent anywhere. */
/**
 * `mode="signin"` turns a successful submit into a MOCK sign-in: a fake session (the email, kept in this browser only) is stored and the
 * visitor is taken to the Playground. Everything else about the form is unchanged.
 */
export default function MockForm({ kind, fields, submitLabel = "Send", compact = false, mode }: { kind: string; fields: Field[]; submitLabel?: string; compact?: boolean; mode?: "signin" }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped after a successful submit so the inputs are re-created: Safari keeps a field in its "autofilled" visual state even after the
  // value is cleared from code, which made the empty placeholder look like typed text.
  const [round, setRound] = useState(0);
  // Editing any field clears the previous result, so a success message never sits under a form that has since been reset or changed.
  const setVal = (name: string, v: string) => { setMsg(null); setVals((p) => ({ ...p, [name]: v })); };
  // Tell the browser what each field is (name + autocomplete), so autofill picks the right value and the form is a normal, labelled form.
  const ac = (f: Field) => (f.name === "email" ? "email" : f.name === "name" ? "name" : f.name === "organization" ? "organization" : "off");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`/api/mock/forms/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(vals) });
      const j = await r.json();
      if (j.ok && mode === "signin") {
        setMsg({ ok: true, text: "Mock sign-in OK. Taking you to the Playground…" });
        setMockSession((vals.email ?? "").trim());
        router.push("/developer?tab=playground");
        return; // keep the form as it is while navigating
      }
      setMsg({ ok: !!j.ok, text: j.message ?? j.error });
      if (j.ok) { setVals({}); setRound((n) => n + 1); }
    } finally { setBusy(false); }
  }

  const input = "w-full rounded-control border border-[var(--control-border)] bg-surface px-3 py-2 text-fs-body";
  return (
    <form onSubmit={submit} className={`mock-form space-y-4 rounded-panel border border-border bg-surface ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <DevOnly><p className="text-fs-xs text-muted"><MockBadge>mock form</MockBadge> Submitting stores nothing and sends nothing.</p></DevOnly>
      {fields.map((f) => (
        <div key={`${f.name}-${round}`}>
          <label htmlFor={`${kind}-${f.name}`} className="mb-1 block text-fs-ui font-medium">{f.label}{f.required && " *"}</label>
          {f.type === "textarea" ? (
            <textarea id={`${kind}-${f.name}`} name={f.name} aria-required={f.required || undefined} rows={4} className={input} placeholder={f.placeholder} value={vals[f.name] ?? ""} onChange={(e) => setVal(f.name, e.target.value)} />
          ) : f.type === "select" ? (
            <select id={`${kind}-${f.name}`} name={f.name} aria-required={f.required || undefined} className={input} value={vals[f.name] ?? ""} onChange={(e) => setVal(f.name, e.target.value)}>
              <option value="">Select…</option>
              {f.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input id={`${kind}-${f.name}`} name={f.name} type={f.type ?? "text"} autoComplete={ac(f)} aria-required={f.required || undefined} className={input} placeholder={f.placeholder} value={vals[f.name] ?? ""} onChange={(e) => setVal(f.name, e.target.value)} />
          )}
        </div>
      ))}
      <button disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Sending…" : submitLabel}</button>
      <p aria-live="polite" className={`min-h-5 text-fs-ui ${msg?.ok ? "text-success" : "text-error"}`}>{msg?.text}</p>
    </form>
  );
}
