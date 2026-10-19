import type { Metadata } from "next";
import { HubIndex } from "@/components/Hub";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Topics | ${BRAND_SUFFIX}` };

// Topic clusters: index plus placeholder detail pages.
export default function Page() {
  return <HubIndex noun="topics" hub="topics" base="/topics" eyebrow="Topics" title="Browse by topic." lead="Clusters covering the topics, workflows and tool categories we write about." />;
}
