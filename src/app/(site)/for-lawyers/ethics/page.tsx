import type { Metadata } from "next";
import StructuredPage from "@/components/StructuredPage";
import { structured } from "@/data/extraPages";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `AI & lawyer ethics | ${BRAND_SUFFIX}` };

export default function Page() {
  return <StructuredPage page={structured["ethics"]} dataFile="src/data/extraPages.ts" />;
}
