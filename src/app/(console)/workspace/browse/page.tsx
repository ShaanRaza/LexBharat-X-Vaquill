import type { Metadata } from "next";
import ConsoleShell from "@/components/console/ConsoleShell";
import BrowseLaws from "@/components/workspace/BrowseLaws";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Browse Laws & Judgments | ${BRAND_SUFFIX} (local mock)`, robots: { index: false, follow: false } };

// /workspace/browse: the "Acts & Judgments" area. `?tab=acts` opens the Acts & Legislation tab.
export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ConsoleShell variant="workspace"><BrowseLaws initialTab={tab === "acts" ? "acts" : "judgments"} /></ConsoleShell>;
}
