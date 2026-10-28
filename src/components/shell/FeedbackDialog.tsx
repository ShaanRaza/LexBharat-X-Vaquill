"use client";
import { useEffect, useId, useRef } from "react";
import { Button, Notice, Panel, fieldClass } from "@/components/kit";
import { MAX_MESSAGE } from "@/lib/insights/rules.mjs";
import { Icon } from "./icons";
import { useFeedbackForm } from "./useFeedbackForm";

// "Feedback" from the top-bar menu: a message and an optional email, saved for the team to read in /admin. Nothing is emailed. Presentation only; sending is in useFeedbackForm.
export default function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const f = useFeedbackForm(), uid = useId(), box = useRef<HTMLDivElement>(null), first = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { first.current?.focus(); const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key !== "Tab" || !box.current) return;
    const els = [...box.current.querySelectorAll<HTMLElement>("textarea,input,button")].filter((x) => !(x as HTMLButtonElement).disabled); if (!els.length) return;
    const a = els[0], z = els[els.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onKeyDown={onKey} className="w-full max-w-dialog">
        <Panel as="div" className="rounded-b-none sm:rounded-b-card">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`${uid}-t`} className="font-serif text-fs-display">Feedback</h2>
            <button type="button" onClick={onClose} aria-label="Close feedback" className="grid size-8 place-items-center rounded-button text-muted hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"><Icon name="close" /></button>
          </div>
          {f.state === "sent" ? (
            <div className="mt-3 space-y-4">
              <Notice tone="complete" role="status" compact><p>Thank you. Your message was saved and the team will read it.</p></Notice>
              <Button variant="primary" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); f.send(); }}>
              <p className="text-ui-base text-secondary">What happened, or what would help? Don&apos;t include confidential client information.</p>
              <div><label htmlFor={`${uid}-m`} className="text-ui-base font-medium">Your message</label>
                <textarea id={`${uid}-m`} ref={first} required rows={5} maxLength={MAX_MESSAGE} value={f.message} onChange={(e) => f.setMessage(e.target.value)} className={`${fieldClass} mt-1 h-auto py-2`} /></div>
              <div><label htmlFor={`${uid}-e`} className="text-ui-base font-medium">Email <span className="font-normal text-muted">(optional)</span></label>
                <input id={`${uid}-e`} type="email" autoComplete="email" value={f.email} onChange={(e) => f.setEmail(e.target.value)} className={`${fieldClass} mt-1`} />
                <p className="mt-1 text-ui-sm text-muted">Only used to follow up on your message. Nothing is sent to this address automatically.</p></div>
              {f.state === "error" && <Notice tone="bad" role="alert" compact><p>{f.error}</p></Notice>}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="primary" disabled={f.state === "sending" || f.message.trim().length < 3}>{f.state === "sending" ? "Sending…" : "Send feedback"}</Button>
                <Button variant="quiet" onClick={onClose}>Cancel</Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
}
