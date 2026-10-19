import { HubArticle, params } from "@/components/Hub";

export function generateStaticParams() { return params("engineering"); }
export const dynamicParams = false;

export default async function Page({ params: p }: { params: Promise<{ slug: string }> }) {
  const { slug } = await p;
  return <HubArticle hub="engineering" slug={slug} eyebrow="Engineering" back="/engineering" backLabel="engineering" />;
}
