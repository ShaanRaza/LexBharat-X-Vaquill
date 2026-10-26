import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero, Section, Prose, DataNote } from "./ui";
import MockBadge from "./MockBadge";
import HubList from "./HubList";
import { hubs, type HubKey } from "@/data/hubs";
import DevOnly from "@/components/DevOnly";

/** Index page for a content hub: full title list with search, filter and pagination. */
export function HubIndex({ hub, eyebrow, title, lead, linked = true, base, noun }: { hub: HubKey; eyebrow: string; title: string; lead: string; linked?: boolean; base: string; noun: string }) {
  const items = hubs[hub];
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} lead={lead} />
      <Section>
        <DevOnly><p className="mb-6 text-fs-sm text-muted"><MockBadge>titles only</MockBadge> All {items.length} entries from the public listing are present. Their bodies are placeholders.</p></DevOnly>
        <HubList items={items} base={base} linked={linked} noun={noun} />
      </Section>
      <DataNote kind="placeholder" files={["src/data/hubs.generated.ts", "src/data/hubs.ts"]} />
    </>
  );
}

/** Detail page: placeholder article body. Includes previous/next and related entries from the same hub. */
export function HubArticle({ hub, slug, eyebrow, back, backLabel }: { hub: HubKey; slug: string; eyebrow: string; back: string; backLabel: string }) {
  const list = hubs[hub];
  const idx = list.findIndex((i) => i.slug === slug);
  if (idx < 0) notFound();
  const item = list[idx];
  const prev = list[idx - 1];
  const next = list[idx + 1];
  const related = list.filter((i) => i.slug !== slug && (item.category ? i.category === item.category : true)).slice(0, 3);
  return (
    <>
      <PageHero eyebrow={item.category ?? eyebrow} title={item.title} lead={item.summary || "Recreated placeholder page. Only the title is taken from the public listing."} />
      <Section>
        <Prose>
          <DevOnly><p><MockBadge>recreated placeholder</MockBadge> The real site publishes a full article here. This build keeps the title, the category and this stand-in text only.</p></DevOnly>
          <h2>Overview</h2>
          <p>Placeholder overview for “{item.title}”. A full version would state the problem, the legal background and the practical steps, with citations to primary law.</p>
          <h2>Key points</h2>
          <ul><li>Placeholder point one.</li><li>Placeholder point two, with a citation-style reference such as 42 U.S.C. § 1983.</li><li>Placeholder point three: what to check next.</li></ul>
          <h2>Related</h2>
          <ul>{related.map((r) => <li key={r.slug}><Link href={`${back}/${r.slug}`}>{r.title}</Link></li>)}</ul>
          <p><Link href={back}>← Back to {backLabel}</Link></p>
        </Prose>
        <nav className="mt-10 flex max-w-w760 flex-wrap justify-between gap-4 border-t border-border pt-6 text-fs-body" aria-label="Previous and next">
          {prev ? <Link href={`${back}/${prev.slug}`} className="inline-block max-w-[45%] py-1.5 text-primary hover:underline">← {prev.title}</Link> : <span />}
          {next ? <Link href={`${back}/${next.slug}`} className="inline-block max-w-[45%] py-1.5 text-right text-primary hover:underline">{next.title} →</Link> : <span />}
        </nav>
      </Section>
      <DataNote kind="placeholder" files={["src/data/hubs.generated.ts", "src/data/hubs.ts"]} />
    </>
  );
}

export function params(hub: HubKey) { return hubs[hub].map((i) => ({ slug: i.slug })); }
