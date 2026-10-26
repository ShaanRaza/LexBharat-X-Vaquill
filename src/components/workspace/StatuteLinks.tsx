import Link from "next/link";
import { RepealedNote } from "@/components/kit";
import { segments } from "@/lib/judgments/statuteLinks.mjs";
import type { Resolved } from "@/lib/judgments/statuteResolve";

// Presentation only: mentions arrive resolved from src/lib/judgments/statuteLinks.ts. Colours, sizes and radii come from the shared tokens.
const linkClass = "rounded-chip text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-primary";

/** The judgment's opening text with each Act section it names turned into a link (only where we hold that section). */
export default function StatuteText({ text, mentions }: { text: string; mentions: Resolved[] }) {
  return (
    <>
      {segments(text, mentions).map((p, i) => {
        const m = p.mention as Resolved | undefined;
        if (!m || !m.href) return <span key={i}>{p.text}</span>;
        return <Link key={i} href={m.href} className={linkClass} title={`${m.label} of ${m.actName}${m.state === "missing" ? " (missing from our source data)" : ""}`}>{p.text}</Link>;
      })}
    </>
  );
}

/** "Laws referred to": the Acts named in the text and which of their sections we can open. */
export function LawsReferred({ laws }: { laws: { actKey: string; actName: string; items: Resolved[] }[] }) {
  if (!laws.length) return null;
  return (
    <div className="mt-4 border-t border-border/60 pt-3">
      <h3 className="text-ui-xs font-semibold uppercase tracking-caps text-secondary">Laws referred to</h3>
      <ul className="mt-2 space-y-1.5 text-ui-sm">
        {laws.map((l) => (
          <li key={l.actKey} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium">{l.actName}</span>{l.items[0]?.actId && <RepealedNote actId={l.items[0].actId} />}
            <span className="flex flex-wrap gap-1.5">
              {l.items.map((m) => m.href
                ? <Link key={m.label} href={m.href} className={`${linkClass} inline-flex min-h-8 items-center px-1`}>{m.label}{m.state === "missing" ? " (missing from source data)" : ""}</Link>
                : <span key={m.label} className="inline-flex min-h-8 items-center px-1 text-secondary" title="We do not hold this text, so it is not linked">{m.label}</span>)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-ui-xs text-muted">Found by reading the judgment text shown on this page; a section is linked only when the Act and number are both clear and the text is in our data.</p>
    </div>
  );
}
