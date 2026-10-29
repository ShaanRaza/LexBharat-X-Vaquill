"use client";
import { useEffect, useId, useRef, useState } from "react";
import LogoutLink from "@/components/LogoutLink";
import { Icon } from "./icons";
import FeedbackDialog from "./FeedbackDialog";

// The small menu at the right of the top bar: Feedback and Log out. Escape or a click outside closes it and focus returns to the button. Presentation only.
export default function UserMenu() {
  const [open, setOpen] = useState(false), [feedback, setFeedback] = useState(false), root = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), uid = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? uid : undefined} aria-label="Menu: Feedback and Log out"
        className="grid size-9 place-items-center rounded-button text-muted hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><Icon name="more" className="size-5" /></button>
      {open && (
        <div id={uid} role="menu" aria-label="Menu" className="absolute right-0 top-full z-40 mt-1 w-44 rounded-card bg-surface p-1.5 text-ui-base shadow-lg ring-1 ring-border">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setFeedback(true); }} className="flex w-full rounded-field px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">Feedback</button>
          <LogoutLink role="menuitem" className="flex w-full rounded-field px-3 py-2 text-left text-ui-base text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" />
        </div>
      )}
      {feedback && <FeedbackDialog onClose={() => { setFeedback(false); btn.current?.focus(); }} />}
    </div>
  );
}
