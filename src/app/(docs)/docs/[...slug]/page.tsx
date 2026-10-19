import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { allDocPages, docsNav, guideNav, endpointSlug, INDIA_REF } from "@/data/docs/nav";
import { docPages, docAliases, type Block } from "@/data/docs/pages";
import { endpoints, type Endpoint } from "@/data/endpoints";
import { corpus } from "@/data/corpus";
import { CodeBlock, SimpleTable, DataNote } from "@/components/ui";
import MockBadge from "@/components/MockBadge";
import DevOnly from "@/components/DevOnly";
import { dev, RELEASE, DOCS_SUFFIX } from "@/lib/release";
import CopyPage from "@/components/docs/CopyPage";
import DocsToc, { type TocItem } from "@/components/docs/DocsToc";
import PageFeedback from "@/components/docs/PageFeedback";
import DocsCode from "@/components/docs/DocsCode";

const H = "https://api.lexbharat.example";
const LAST_MODIFIED = "October 20, 2026"; // the date these recreated pages were last edited in this project
const aliasKeys = Object.keys(docAliases);

export function generateStaticParams() {
  return [...allDocPages.map((p) => p.slug), ...aliasKeys].map((s) => ({ slug: s.split("/") }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const k = slug.join("/");
  const nav = allDocPages.find((p) => p.slug === (docAliases[k] ?? k));
  return { title: `${nav?.title ?? "Docs"} | ${DOCS_SUFFIX}` };
}

const idOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Inline markup in doc text: [label](/docs/path) links and `code`.
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g).map((part, i) => {
        const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (m) return <Link key={i} href={m[2]} className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{m[1]}</Link>;
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i} className="rounded-md bg-[#4b5563]/10 px-1.5 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const HEAD_OFFSET = "scroll-mt-[calc(var(--docs-hh,152px)+24px)]";
function Anchor({ id }: { id: string }) {
  return <a href={`#${id}`} aria-label="Link to this section" className="ml-2 text-[#65625f] opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100">#</a>;
}

function Render({ b }: { b: Block }) {
  if (b.t === "p") return <p className="text-[16px] leading-7 text-[#414040]"><Inline text={b.v} /></p>;
  if (b.t === "h2") return <h2 id={idOf(b.v)} className={`group mt-10 text-[24px] font-semibold leading-8 tracking-[-0.01em] text-[#1a1818] ${HEAD_OFFSET}`}>{b.v}<Anchor id={idOf(b.v)} /></h2>;
  if (b.t === "h3") return <h3 id={idOf(b.v)} className={`group mt-7 text-[20px] font-semibold leading-7 text-[#1a1818] ${HEAD_OFFSET}`}>{b.v}<Anchor id={idOf(b.v)} /></h3>;
  if (b.t === "code") return <DocsCode code={b.v} label={b.label} />;
  if (b.t === "list") return <ul className="list-disc space-y-1.5 pl-6 text-[16px] leading-7 text-[#414040]">{b.v.map((x) => <li key={x}><Inline text={x} /></li>)}</ul>;
  if (b.t === "note") return RELEASE ? null : <p className="rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-[14px] text-warning">{b.v}</p>;
  if (b.t === "cards") return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {b.v.map((c) => (
        <Link key={c.title} href={c.href} className="group block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/40">
          <h3 className="text-[16px] font-semibold leading-6 text-[#1a1818]">{c.title}</h3>
          <p className="mt-2 text-[14px] leading-6 text-[#535151]"><Inline text={c.text} /></p>
        </Link>
      ))}
    </div>
  );
  if (b.t === "linkcard") return (
    <Link href={b.href} className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/40">
      <h3 className="text-[16px] font-semibold leading-6 text-[#1a1818]">{b.title}</h3>
      <p className="mt-1 text-[14px] leading-6 text-[#535151]">{b.text}</p>
    </Link>
  );
  return <SimpleTable head={b.head} rows={b.rows} />;
}

const pathParams = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const queryParams: Record<string, [string, string][]> = {
  "/api/v1/us/statutes/resolve": [["cite", "The citation string to resolve"]],
  "/us/statutes/search": [["query", "Search text"], ["corpusType", "Scope, e.g. USC, CFR, STATE"], ["state", "Two-letter code, for STATE corpora"], ["limit", "Page size"], ["offset", "Page offset"], ["includeBody", "Return full text with results"]],
  "/api/v1/us/statutes/sections": [["actIds", "Up to 50 section ids"]],
  "/api/v1/us/statutes/divisions": [["corpusType", "Which code"], ["state", "For state codes"], ["parent", "Division to list children of"]],
  "/api/v1/us/statutes/section/{act_id}/body": [["asOf", "Optional date (YYYY-MM-DD) for point-in-time text"]],
  "/api/v1/watches": [["corpusType", "Source to watch"], ["state", "For state sources"], ["channel", "email, webhook or both"]],
};

function EndpointPage({ e }: { e: Endpoint }) {
  const sample = corpus[0];
  const params = [...pathParams(e.path).map((n) => [n, "path", "Required"] as string[]), ...(queryParams[e.path] ?? []).map(([n, d]) => [n, e.method === "POST" ? "body" : "query", d])];
  return (
    <article className="max-w-[820px] space-y-5">
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-primary">API reference · {e.group}</p>
      <h1 className="text-[32px] font-semibold tracking-[-0.03em]">{e.summary.replace(/\.$/, "")}</h1>
      <p className="font-mono text-[14px]"><span className="rounded-control bg-primary/10 px-2 py-0.5 text-primary">{e.method}</span> {e.path}</p>
      <DevOnly><p className="text-[13px] text-muted"><MockBadge>recreated</MockBadge> Parameters and the sample response are illustrative. Costs in credits are invented for this build.</p></DevOnly>
      <h2 className="mt-6 text-[22px] font-semibold">Parameters</h2>
      {params.length ? <SimpleTable head={["Name", "In", "Description"]} rows={params.map(([n, i, d]) => [<code key={n} className="font-mono text-[12.5px]">{n}</code>, i, d])} /> : <p className="text-[15px] text-muted">No parameters.</p>}
      <h2 className="mt-6 text-[22px] font-semibold">Example request</h2>
      <CodeBlock label="curl (illustrative)" code={`curl ${e.method === "GET" ? "-G " : "-X POST "}${H}${e.path} \\\n  -H "Authorization: Bearer lb_key_..."`} />
      <h2 className="mt-6 text-[22px] font-semibold">Example response</h2>
      <CodeBlock label="JSON (mock record)" code={JSON.stringify({ _mock: true, actId: sample.id, citation: sample.cite, title: sample.title, actStatus: "in_force", currentThrough: "2026-09-18" }, null, 2)} />
      <p className="text-[14px] text-muted">Credits: {e.credits === 0 ? "free" : e.credits}. Try this call in the <Link href="/playground" className="text-primary hover:underline">Playground</Link>.</p>
    </article>
  );
}

export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  let key = slug.join("/");
  const aliasOf = docAliases[key];
  if (aliasOf) key = aliasOf;
  const nav = allDocPages.find((p) => p.slug === key);
  if (!nav) notFound();

  if (key === "api-reference") {
    const groups = [...new Set(endpoints.map((e) => e.group))];
    return (
      <div className="max-w-[900px]">
        <h1 className="text-[36px] font-semibold tracking-[-0.03em]">API Reference</h1>
        <p className="mt-2 text-[16px] text-muted">{dev("The endpoints recreated in this build (12 of the 29 the public marketing page mentions). ")}Open one for parameters and an example. Try them in the <Link className="text-primary hover:underline" href="/playground">Playground</Link>.</p>
        <div className="mt-6 space-y-8">
          {groups.map((g) => (
            <section key={g}><h2 className="mb-2 text-[18px] font-semibold">{g}</h2>
              <SimpleTable head={["Method", "Path", "Summary"]} rows={endpoints.filter((e) => e.group === g).map((e) => [<span key="m" className="font-mono text-[12px]">{e.method}</span>, <Link key="p" href={`/docs/${endpointSlug(e)}`} className="font-mono text-[12.5px] text-primary hover:underline">{e.path}</Link>, e.summary])} />
            </section>
          ))}
        </div>
        <div className="mt-10"><DataNote kind="static" files={["src/data/endpoints.ts"]} /></div>
      </div>
    );
  }

  const ep = endpoints.find((e) => endpointSlug(e) === key);
  if (ep) return <><EndpointPage e={ep} /><div className="mt-10"><DataNote kind="static" files={["src/data/endpoints.ts", "src/data/corpus.ts (mock record)"]} /></div></>;

  if (key === INDIA_REF) {
    return (
      <article className="max-w-[820px] space-y-5">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-primary">India API reference</p>
        <h1 className="text-[32px] font-semibold tracking-[-0.03em]">India API credit pricing</h1>
        <p className="font-mono text-[14px]"><span className="rounded-control bg-primary/10 px-2 py-0.5 text-primary">GET</span> /api/v1/in/pricing</p>
        <p className="text-[16px] text-muted">Returns the credit cost of each India endpoint. {dev(" Illustrative page: there is no India API in this build.")}</p>
        <CodeBlock label="example response (mock)" code={JSON.stringify({ _mock: true, endpoints: [{ path: "/api/v1/in/acts/coverage", credits: 0 }, { path: "/api/v1/in/acts/search", credits: 2 }] }, null, 2)} />
        <DataNote kind="placeholder" files={["src/app/(docs)/docs/[...slug]/page.tsx"]} />
      </article>
    );
  }

  const page = docPages[key];
  const idx = allDocPages.findIndex((p) => p.slug === key);
  const prev = allDocPages[idx - 1];
  const next = allDocPages[idx + 1];
  const toc: TocItem[] = (page?.blocks ?? []).flatMap((b): TocItem[] => b.t === "h2" ? [{ id: idOf(b.v), label: b.v, level: 2 }] : b.t === "h3" ? [{ id: idOf(b.v), label: b.v, level: 3 }] : []);
  const group = guideNav.find((s) => s.pages.some((p) => p.slug === key))?.title ?? docsNav.find((s) => s.pages.some((p) => p.slug === key))?.title ?? "Docs";
  const chev = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
  return (
    <div className="flex justify-between gap-10">
      <article className="min-w-0 max-w-[689px] flex-1">
        <p className="mb-2.5 text-[12px] font-semibold uppercase leading-5 tracking-[0.06em] text-[#65625f]">{group}</p>
        <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[30px] font-semibold leading-10 tracking-tight text-[#1a1818] [overflow-wrap:anywhere] sm:text-[36px]">{page?.title ?? nav.title}</h1>
          <CopyPage />
        </div>
        {aliasOf && <DevOnly><p className="mt-3 text-[13px] text-muted"><MockBadge>alias</MockBadge> On the real site this address shows the same page as “{nav.title}”.</p></DevOnly>}
        {page ? (
          <div className="mt-4 space-y-4">
            <p className="text-[16px] leading-7 text-[#535151]"><Inline text={page.lead} /></p>
            {page.blocks.map((b, i) => <Render key={i} b={b} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-panel border border-dashed border-border bg-surface p-6">
            <p><MockBadge>no content</MockBadge></p>
            <p className="mt-3 text-[16px] text-muted">This sidebar entry has no recreated text.</p>
          </div>
        )}
        <div className="mt-12 space-y-6 border-t border-border/70 pt-6">
          <p className="text-[14px] text-[#65625f]">Last modified on {LAST_MODIFIED}</p>
          <PageFeedback />
          <nav className="flex items-center justify-between gap-6 text-[14px] font-semibold text-[#414040]" aria-label="Previous and next page">
            {prev ? <Link href={`/docs/${prev.slug}`} className="inline-flex min-h-9 max-w-[48%] items-center gap-2 rounded-lg py-1.5 hover:text-primary">{chev("M15 6l-6 6 6 6")}<span>{prev.title}</span></Link> : <span />}
            {next ? <Link href={`/docs/${next.slug}`} className="inline-flex min-h-9 max-w-[48%] items-center gap-2 rounded-lg py-1.5 text-right hover:text-primary"><span>{next.title}</span>{chev("M9 6l6 6-6 6")}</Link> : <span />}
          </nav>
          <DataNote kind="placeholder" files={["src/data/docs/nav.ts", "src/data/docs/pages.ts"]} />
        </div>
      </article>
      {toc.length > 1 && <DocsToc items={toc} />}
    </div>
  );
}
