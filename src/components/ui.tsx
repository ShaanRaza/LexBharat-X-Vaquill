import Link from "next/link";
import MockBadge from "./MockBadge";
import { RELEASE } from "@/lib/release";

/* Small shared building blocks for the inner pages. Server-safe (no hooks). */

export function PageHero({
  eyebrow, title, lead, actions, children,
}: {
  eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode;
  actions?: { label: string; href: string; variant?: "primary" | "secondary"; disabled?: boolean }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-4 pb-14 pt-40 sm:px-6 sm:pb-20 sm:pt-48 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute -right-48 top-0 h-[780px] w-[780px] rounded-full border border-foreground/5" />
      <div className="mx-auto max-w-w1152">
        {eyebrow && <p className="mb-4 font-mono text-fs-xs uppercase tracking-caps-xwide text-primary">{eyebrow}</p>}
        <h1 className="max-w-w900 text-fs-38 font-semibold leading-display tracking-brand sm:text-fs-56">{title}</h1>
        {lead && <p className="mt-6 max-w-w720 text-fs-xl leading-relaxed text-muted">{lead}</p>}
        {actions && (
          <div className="mt-8 flex flex-wrap gap-3">
            {actions.map((a) => a.disabled ? (
              <span key={a.label} role="link" aria-disabled="true" title="Placeholder: no destination in this build" className={`btn ${a.variant === "secondary" ? "btn-secondary" : "btn-primary"} cursor-not-allowed opacity-50`}>{a.label}</span>
            ) : (
              <Link key={a.label} href={a.href} className={`btn ${a.variant === "secondary" ? "btn-secondary" : "btn-primary"}`}>{a.label}</Link>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Section({
  id, title, lead, tone = "plain", children,
}: { id?: string; title?: React.ReactNode; lead?: React.ReactNode; tone?: "plain" | "accent" | "dark"; children?: React.ReactNode }) {
  const bg = tone === "accent" ? "bg-accent" : tone === "dark" ? "bg-dark text-background" : "";
  return (
    <section id={id} className={`px-4 py-14 sm:px-6 sm:py-20 lg:px-8 ${bg}`}>
      <div className="mx-auto max-w-w1152">
        {title && <h2 className={`max-w-w820 text-fs-title font-semibold tracking-snug sm:text-fs-38 ${tone === "dark" ? "font-serif font-normal" : ""}`}>{title}</h2>}
        {lead && <p className={`mt-3 max-w-w720 text-fs-17 leading-relaxed ${tone === "dark" ? "text-background/70" : "text-muted"}`}>{lead}</p>}
        <div className={title || lead ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}




export function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full min-w-[520px] text-left text-fs-body">
        <thead className="border-b border-border bg-raised text-fs-sm uppercase tracking-wider text-muted">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => <td key={j} className="px-4 py-3 align-top">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}




const kindLabel = {
  static: "Static data (checked into the repo)",
  "mock-api": "Mock API data (local route handlers)",
  placeholder: "Hardcoded placeholder content",
  mixed: "Mixed: static + placeholder + mock API",
} as const;

/** Shown at the foot of every page so a non-technical reader can see where the content comes from. */
export function DataNote({ kind, files }: { kind: keyof typeof kindLabel; files: string[] }) {
  if (RELEASE) return null;
  return (
    <aside className="border-t border-border px-4 py-5 sm:px-6 lg:px-8" aria-label="Where this page's data comes from">
      <div className="mx-auto flex max-w-w1152 flex-wrap items-center gap-x-3 gap-y-1 text-fs-12.5 text-muted">
        <MockBadge>data source</MockBadge>
        <span className="font-medium text-foreground">{kindLabel[kind]}</span>
        <span className="font-mono">{files.join(" · ")}</span>
      </div>
    </aside>
  );
}

