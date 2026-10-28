import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import ReviewHome from "@/components/workspace/review/ReviewHome";
import ReviewRunView from "@/components/workspace/review/ReviewRunView";
import { isUuid } from "@/lib/vault/ids";
import workspace from "@/config/workspace.json";

export const metadata: Metadata = { title: "Reviews | LexBharat" };
// /workspace/review and /workspace/review/<review id>. Off (404) while the review flag in src/config/workspace.json is false.
export default async function ReviewPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  if (!workspace.features.review.enabled) notFound();
  if (slug.length > 1 || (slug.length === 1 && !isUuid(slug[0]))) notFound();
  return <AppShell>{slug.length ? <ReviewRunView key={slug[0]} id={slug[0]} /> : <ReviewHome />}</AppShell>;
}
