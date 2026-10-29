import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import DocView from "@/components/workspace/vault/DocView";
import VaultApp from "@/components/workspace/vault/VaultApp";
import { isUuid } from "@/lib/vault/ids";
import workspace from "@/config/workspace.json";

export const metadata: Metadata = { title: "Vault | LexBharat" };
// /work/vault and /work/vault/<document id>. Off (404) while the vault flag in src/config/workspace.json is false.
export default async function VaultPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (!workspace.features.vault.enabled) notFound();
  if (slug.length > 1 || (slug.length === 1 && !isUuid(slug[0]))) notFound();
  return <AppShell>{slug.length ? <DocView key={slug[0]} id={slug[0]} /> : <VaultApp />}</AppShell>;
}
