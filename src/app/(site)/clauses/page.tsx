import type { Metadata } from "next";
import { HubIndex } from "@/components/Hub";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Clauses | ${BRAND_SUFFIX}` };

export default function Page() {
  return <HubIndex noun="clauses" hub="clauses" base="/clauses" eyebrow="Clauses" title="The contract clauses that matter, explained clause by clause" lead="For each clause: what it does, market-standard language, fallback positions and red flags." />;
}
