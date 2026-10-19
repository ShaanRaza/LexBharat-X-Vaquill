import { HubArticle, params } from "@/components/Hub";

export function generateStaticParams() { return params("blog"); }
export const dynamicParams = false;

export default async function Page({ params: p }: { params: Promise<{ slug: string }> }) {
  const { slug } = await p;
  return <HubArticle hub="blog" slug={slug} eyebrow="Blog" back="/blog" backLabel="the blog" />;
}
