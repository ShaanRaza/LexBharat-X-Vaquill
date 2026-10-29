import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import SearchPage, { type SearchTab } from "@/components/search/SearchPage";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Search | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /search?q=..&tab=laws|judgments|regulators|documents: the Search page (docs/RESKIN-SPEC.md). The Desk box and Quick-find send what was typed in ?q=.
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const { q, tab } = await searchParams;
  const t: SearchTab = tab === "judgments" || tab === "regulators" || tab === "documents" ? tab : "laws";
  return <AppShell><SearchPage initialQ={(q ?? "").slice(0, 200)} tab={t} /></AppShell>;
}
