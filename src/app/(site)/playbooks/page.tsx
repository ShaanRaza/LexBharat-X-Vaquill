import type { Metadata } from "next";
import { HubIndex } from "@/components/Hub";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Playbooks | ${BRAND_SUFFIX}` };

export default function Page() {
  return <HubIndex noun="playbooks" hub="playbooks" base="/playbooks" eyebrow="Playbooks" title="Negotiation playbooks for the contracts that come up most" lead="Preferred position, acceptable range, fallback ladder and walk-away for every clause that matters." />;
}
