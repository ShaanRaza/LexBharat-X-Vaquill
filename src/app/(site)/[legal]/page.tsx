import type { Metadata } from "next";
import LegalView from "@/components/LegalView";
import { legalPages } from "@/data/legal";
import { BRAND_SUFFIX } from "@/lib/release";

// /security has its own folder (it also has a vulnerability-disclosure sub-page), so it is not generated here.
const slugs = legalPages.filter((l) => l.slug !== "security").map((l) => l.slug);
export function generateStaticParams() { return slugs.map((legal) => ({ legal })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }): Promise<Metadata> {
  const { legal } = await params;
  const p = legalPages.find((l) => l.slug === legal);
  return { title: `${p?.title ?? "Legal"} | ${BRAND_SUFFIX}` };
}

export default async function Legal({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  return <LegalView slug={legal} />;
}
