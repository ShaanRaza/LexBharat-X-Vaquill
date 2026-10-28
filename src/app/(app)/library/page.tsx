import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import BrowseLaws from "@/components/workspace/BrowseLaws";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Library | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /library: the Library (Acts and judgments to browse). `?tab=acts` opens the Acts & Legislation tab.
export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <AppShell><BrowseLaws initialTab={tab === "acts" ? "acts" : "judgments"} initialQuery={(q ?? "").slice(0, 200)} /></AppShell>;
}
