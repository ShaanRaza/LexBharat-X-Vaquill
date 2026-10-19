import type { Metadata } from "next";
import StructuredPage from "@/components/StructuredPage";
import { structured } from "@/data/extraPages";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Use case: legal tech developers | ${BRAND_SUFFIX}` };

export default function Page() {
  return <StructuredPage page={structured["legal-tech-developers"]} dataFile="src/data/extraPages.ts" />;
}
