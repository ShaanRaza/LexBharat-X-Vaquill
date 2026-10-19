import type { Metadata } from "next";
import { HubIndex } from "@/components/Hub";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Blog | ${BRAND_SUFFIX}` };

export default function Page() {
  return <HubIndex noun="articles" hub="blog" base="/blog" eyebrow="Blog" title="The LexBharat Blog" lead="Latest articles on US primary law, developer guides and primers." />;
}
