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
      <div className="mx-auto max-w-[1152px]">
        {eyebrow && <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.14em] text-primary">{eyebrow}</p>}
        <h1 className="max-w-[900px] text-[38px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[56px]">{title}</h1>
        {lead && <p className="mt-6 max-w-[720px] text-[18px] leading-relaxed text-muted">{lead}</p>}
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
      <div className="mx-auto max-w-[1152px]">
        {title && <h2 className={`max-w-[820px] text-[28px] font-semibold tracking-[-0.025em] sm:text-[38px] ${tone === "dark" ? "font-serif font-normal" : ""}`}>{title}</h2>}
        {lead && <p className={`mt-3 max-w-[720px] text-[17px] leading-relaxed ${tone === "dark" ? "text-background/70" : "text-muted"}`}>{lead}</p>}
        <div className={title || lead ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function CardGrid({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const c = cols === 2 ? "md:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid gap-4 ${c}`}>{children}</div>;
}

export function Card({ title, children, href, tag, as: H = "h3" }: { title: React.ReactNode; children?: React.ReactNode; href?: string; tag?: string; as?: "h2" | "h3" }) {
  const body = (
    <article className="h-full rounded-panel border border-border bg-surface p-6 transition-transform duration-300 ease-out hover:-translate-y-0.5">
      {tag && <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-primary">{tag}</p>}
      <H className="text-[18px] font-semibold leading-snug">{title}</H>
      {children && <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div>}
    </article>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-panel border border-[var(--code-border)] bg-[var(--code-bg)]">
      {label && <div className="border-b border-[var(--code-border)] px-4 py-2 font-mono text-[12px] text-muted">{label}</div>}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-[#2c2620]">{code}</pre>
    </div>
  );
}

export function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-surface">
      <table className="w-full min-w-[520px] text-left text-[15px]">
        <thead className="border-b border-border bg-raised text-[13px] uppercase tracking-wider text-muted">
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

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-serif text-[34px] leading-none text-primary">{value}</p>
      <p className="mt-2 text-[14px] text-muted">{label}</p>
    </div>
  );
}

export function Bullets({ items, tone = "check" }: { items: string[]; tone?: "check" | "cross" | "dot" }) {
  const g = tone === "check" ? "✓" : tone === "cross" ? "✗" : "•";
  const c = tone === "check" ? "text-success" : tone === "cross" ? "text-error" : "text-primary";
  return (
    <ul className="space-y-2 text-[15px]">
      {items.map((x) => <li key={x} className="flex gap-2"><span className={c}>{g}</span><span>{x}</span></li>)}
    </ul>
  );
}

export function CtaBand({ title, primary, secondary }: { title: string; primary: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  return (
    <section className="relative overflow-hidden bg-dark px-4 py-16 text-background sm:px-6 sm:py-20 lg:px-8">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,#6e373066,transparent_55%)]" />
      <div className="relative mx-auto max-w-[1152px]">
        <h2 className="max-w-[760px] font-serif text-[32px] leading-tight sm:text-[46px]">{title}</h2>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={primary.href} className="btn bg-background text-foreground hover:bg-white">{primary.label}</Link>
          {secondary && <Link href={secondary.href} className="btn border border-background/40 hover:border-background">{secondary.label}</Link>}
        </div>
      </div>
    </section>
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
      <div className="mx-auto flex max-w-[1152px] flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        <MockBadge>data source</MockBadge>
        <span className="font-medium text-foreground">{kindLabel[kind]}</span>
        <span className="font-mono">{files.join(" · ")}</span>
      </div>
    </aside>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[760px] space-y-4 text-[16px] leading-[1.75] [&_h2]:mt-10 [&_h2]:text-[24px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h3]:mt-6 [&_h3]:text-[18px] [&_h3]:font-semibold [&_a]:text-primary [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_code]:rounded [&_code]:bg-raised [&_code]:px-1 [&_code]:font-mono [&_code]:text-[13px] text-foreground/90">{children}</div>;
}
