import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import BrowseLaws from "@/components/workspace/BrowseLaws";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Search | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /search: INTERIM. The Acts search box of the Acts & Judgments browser under its own address, so the top bar can tell Search from Library by the path alone. Phase 5 of
// docs/RESKIN-IA-PLAN.md replaces this page with the real Search page (tabs, filters, "Your documents") at the same address.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <AppShell><BrowseLaws initialTab="acts" initialQuery={(q ?? "").slice(0, 200)} /></AppShell>;
}
