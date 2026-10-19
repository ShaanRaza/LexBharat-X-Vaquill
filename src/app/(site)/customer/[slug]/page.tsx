import { notFound } from "next/navigation";
import { PageHero, Section, Prose, DataNote } from "@/components/ui";
import { customers } from "@/data/company";

export function generateStaticParams() { return customers.map((c) => ({ slug: c.slug })); }

export default async function Story({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = customers.find((x) => x.slug === slug);
  if (!c) notFound();
  return (
    <>
      <PageHero eyebrow={c.tag} title={c.title} lead={c.summary} />
      <Section>
        <figure className="mb-8 max-w-[760px] border-l-4 border-primary pl-6">
          <blockquote className="font-serif text-[26px] leading-snug">“{c.quote}”</blockquote>
          <figcaption className="mt-3 text-[15px] text-muted">{c.who} (fictional)</figcaption>
        </figure>
        <Prose>{c.body.map((p) => <p key={p}>{p}</p>)}</Prose>
      </Section>
      <DataNote kind="placeholder" files={["src/data/company.ts"]} />
    </>
  );
}
