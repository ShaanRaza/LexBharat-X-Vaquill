import { HubArticle, params } from "@/components/Hub";

export function generateStaticParams() { return params("clauses"); }
export const dynamicParams = false;

export default async function Page({ params: p }: { params: Promise<{ slug: string }> }) {
  const { slug } = await p;
  return <HubArticle hub="clauses" slug={slug} eyebrow="Clauses" back="/clauses" backLabel="clauses" />;
}
