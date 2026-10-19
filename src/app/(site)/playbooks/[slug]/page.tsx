import { HubArticle, params } from "@/components/Hub";

export function generateStaticParams() { return params("playbooks"); }
export const dynamicParams = false;

export default async function Page({ params: p }: { params: Promise<{ slug: string }> }) {
  const { slug } = await p;
  return <HubArticle hub="playbooks" slug={slug} eyebrow="Playbooks" back="/playbooks" backLabel="playbooks" />;
}
