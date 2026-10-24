import Link from "next/link";
import table from "@/config/repealed-acts.json";
import overrides from "@/config/status-overrides.json";
import { repealedNote, type RepealedTable } from "@/lib/acts/repealed.mjs";

/** "Repealed — see BNS": a small label with a link to the new Act, shown wherever a repealed Act is linked or cited. Renders nothing for any other Act. */
export default function RepealedNote({ actId, className = "" }: { actId: string | null | undefined; className?: string }) {
  const n = repealedNote(actId, table as RepealedTable);
  if (!n) return null;
  const why = (overrides.overrides as Record<string, { reason: string }>)[actId ?? ""]?.reason;   // present when we corrected the dataset's status
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-chip bg-quality-warn/10 px-2 py-0.5 text-ui-xs text-quality-warn ${className}`} role="note" title={why}>
      <span>Repealed — see</span>
      <Link href={n.href} title={`${n.newName} replaced the ${n.name}`} className="font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-primary">{n.short}</Link>
    </span>
  );
}
