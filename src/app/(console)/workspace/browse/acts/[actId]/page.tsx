import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConsoleShell from "@/components/console/ConsoleShell";
import ActTextView, { type TextState } from "@/components/workspace/ActTextView";
import { getActsStore } from "@/lib/acts";
import { loadActText } from "@/lib/acts/actText";
import { officialSourceUrl } from "@/lib/acts/quality";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export async function generateMetadata({ params }: { params: Promise<{ actId: string }> }): Promise<Metadata> {
  const { actId } = await params;
  const act = await getActsStore().get(actId);
  return { title: `${act?.title ?? "Act"} | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };
}

const label = (v: string) => (v.includes("_") ? v.replace(/_/g, " ") : v.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));

// One Act: section list and full section text from Neon (DATABASE_URL) or the local files (ACTS_TEXT_DATA_DIR); otherwise the honest "not available yet" state. Never throws for missing data.
export default async function ActPage({ params, searchParams }: { params: Promise<{ actId: string }>; searchParams: Promise<{ section?: string }> }) {
  const { actId } = await params, { section } = await searchParams;
  const act = await getActsStore().get(actId);
  if (!act) notFound();
  const text = await loadActText(actId, section);
  const state: TextState = text.available ? { available: true, view: text.view } : { available: false, reason: text.reason, message: text.message };
  const meta = [label(act.category), act.state ? label(act.state) : null, act.department ? label(act.department) : null, label(act.actStatus), act.year !== null ? String(act.year) : null].filter((x): x is string => !!x);
  return (
    <ConsoleShell variant="workspace">
      <ActTextView header={{ actId, title: act.title, meta, officialUrl: text.available ? text.officialUrl : officialSourceUrl(null) }} state={state} />
    </ConsoleShell>
  );
}
