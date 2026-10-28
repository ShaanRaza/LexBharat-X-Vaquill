import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import DraftingApp from "@/components/workspace/drafting/DraftingApp";
import { getTemplate } from "@/lib/drafting/catalog";
import { isDraftId } from "@/lib/drafting/store";
import workspace from "@/config/workspace.json";

export const metadata: Metadata = { title: "Drafting | LexBharat" };
// /workspace/drafting, /workspace/drafting/new/<template id>, /workspace/drafting/<draft id>. Off (404) while the drafting flag in src/config/workspace.json is false.
export default async function DraftingPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (!workspace.features.drafting.enabled) notFound();
  let view: "home" | "form" | "editor", id: string | undefined;
  if (slug.length === 0) view = "home";
  else if (slug.length === 2 && slug[0] === "new" && getTemplate(slug[1])) { view = "form"; id = slug[1]; }
  else if (slug.length === 1 && isDraftId(slug[0])) { view = "editor"; id = slug[0]; }
  else notFound();
  return <AppShell><DraftingApp view={view} id={id} /></AppShell>;
}
