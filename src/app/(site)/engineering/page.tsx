import type { Metadata } from "next";
import { HubIndex } from "@/components/Hub";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Engineering | ${BRAND_SUFFIX}` };

export default function Page() {
  return <HubIndex noun="articles" hub="engineering" base="/engineering" eyebrow="Engineering" title="How we build legal AI" lead="Internals of the product: what verification actually checks, how retrieval works, and what we test." />;
}
