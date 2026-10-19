import { HubArticle, params } from "@/components/Hub";

export function generateStaticParams() { return params("topics"); }
export const dynamicParams = false;

export default async function Page({ params: p }: { params: Promise<{ slug: string }> }) {
  const { slug } = await p;
  return <HubArticle hub="topics" slug={slug} eyebrow="Topics" back="/topics" backLabel="topics" />;
}
