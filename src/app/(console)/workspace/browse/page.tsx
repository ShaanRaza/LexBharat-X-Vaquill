import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import BrowseLaws from "@/components/workspace/BrowseLaws";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Browse Laws & Judgments | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /workspace/browse: the "Acts & Judgments" area. `?tab=acts` opens the Acts & Legislation tab.
export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <AppShell><BrowseLaws initialTab={tab === "acts" ? "acts" : "judgments"} /></AppShell>;
}
