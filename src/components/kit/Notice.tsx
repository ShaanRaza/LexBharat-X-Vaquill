import type { ReactNode } from "react";
import type { Tone } from "./Badge";

// Shared callout for honesty / provenance / unavailable-state messages. `tone` is a meaning; colours come from the tokens.
const TONE: Record<Tone, string> = {
  neutral: "border-border bg-surface",
  complete: "border-quality-complete/40 bg-quality-complete/5",
  warn: "border-quality-warn/40 bg-quality-warn/5",
  bad: "border-quality-bad/40 bg-quality-bad/5",
  info: "border-border bg-accent/60",
};

export default function Notice({ tone = "info", title, children, role, compact = false, className = "" }: { tone?: Tone; title?: string; children: ReactNode; role?: "note" | "status" | "alert"; compact?: boolean; className?: string }) {
  return (
    <aside role={role ?? "note"} className={`rounded-card border ${compact ? "px-3 py-2 text-ui-sm" : "p-card text-ui-base"} text-foreground ${TONE[tone]} ${className}`}>
      {title && <p className="mb-1 text-ui-base font-semibold">{title}</p>}
      <div className="space-y-2 leading-relaxed text-secondary">{children}</div>
    </aside>
  );
}
