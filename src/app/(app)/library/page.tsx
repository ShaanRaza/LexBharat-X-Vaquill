import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/shell/AppShell";
import { Tabs } from "@/components/kit";
import ActsList from "@/components/library/ActsList";
import ConstitutionContents from "@/components/library/ConstitutionContents";
import CourtList from "@/components/library/CourtList";
import RegulatorsList from "@/components/library/RegulatorsList";
import { loadActText } from "@/lib/legal-data";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Library | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };
const COI = "IND_central_COI";   // the Constitution's record id in the Acts data

// /library?tab=acts|constitution|regulators|judgments: everything we hold, each with its source. (Search is its own page: /search.)
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string; category?: string; department?: string; state?: string }> }) {
  const sp = await searchParams, tab = ["constitution", "regulators", "judgments"].includes(sp.tab ?? "") ? (sp.tab as string) : "acts";
  const items = [["acts", "Acts"], ["constitution", "Constitution"], ["regulators", "Regulators"], ["judgments", "Judgments"]].map(([id, label]) => ({ id, label, href: `/library?tab=${id}` }));
  const coi = tab === "constitution" ? await loadActText(COI, undefined).catch(() => null) : null;
  return (
    <AppShell>
      <div className="mx-auto max-w-w1152 pt-2">
        <h1 className="font-serif text-ui-title font-semibold">Library</h1>
        <p className="mt-1 text-ui-base text-secondary">Every Act, the Constitution, regulator instruments and judgments we hold, each with its source.</p>
        <Tabs items={items} current={tab} label="Library sections" className="mt-4" />
        {tab === "acts" && <p className="mt-4 text-ui-base"><Link href="/library/old-to-new" className="font-medium text-primary hover:underline">Old law to new law</Link> <span className="text-secondary">: how IPC, CrPC and the Evidence Act map to BNS, BNSS and BSA</span></p>}
        {tab === "acts" && <ActsList initial={{ category: sp.category, department: sp.department, state: sp.state }} />}
        {tab === "constitution" && <ConstitutionContents actId={COI} items={coi?.available ? coi.view.list.filter((i) => !i.missing) : null} />}
        {tab === "regulators" && <RegulatorsList />}
        {tab === "judgments" && <CourtList />}
      </div>
    </AppShell>
  );
}
