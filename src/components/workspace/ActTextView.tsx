import Link from "next/link";
import { Fragment } from "react";
import { Badge, Notice, Panel, RepealedNote, StatusDot , MarkedPage } from "@/components/kit";
import { buttonClass } from "@/components/kit/controls";
import { PROVENANCE, CHAPTER_NOTE, INCOMPLETE_NOTICE, MISSING_NOTICE } from "@/lib/acts/quality";
import type { ActTextView as View } from "@/lib/acts/viewModel";
import ScheduleTableView, { STAMP_NOTE } from "./ScheduleTableView";
import DisplayText from "@/components/text/DisplayText";
import { docTypeOf, libraryHome, sourceInfo, unitsWord, type DocRef } from "@/lib/docs/docType.mjs";
import { vocabOf } from "@/lib/text/clean.mjs";
import { cleanLabel } from "@/lib/text/clean.mjs";

// Presentation only: every value arrives ready-made from src/lib/acts/viewModel.ts. Colours, sizes and radii come from the shared tokens (Tailwind names + kit components).
export type ActHeader = { actId: string; title: string; meta: string[]; officialUrl: string; /** what kind of document this is (src/lib/docs/docType.mjs): drives the unit name (Section, Article, Rule, Regulation, Paragraph) and where the source is */ doc?: DocRef };
export type TextState = { available: true; view: View } | { available: false; reason: "not_configured" | "not_in_export" | "unreadable"; message: string };

const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const href = (actId: string, key: string) => `/law/${actId}/${encodeURIComponent(key)}`;

/** Shown on every Acts text page, whether or not text is available. */
export function ProvenanceNote({ sectionStatusLabel, doc }: { sectionStatusLabel?: string; doc?: DocRef }) {
  const regulator = !!doc && libraryHome(doc).label === "Regulators";   // a regulator's instrument was not compiled from India Code
  return (
    <Notice title="Where this text comes from" role="note">
      <p>Source dataset: <a className="underline" href={PROVENANCE.datasetUrl} target="_blank" rel="noopener noreferrer">{regulator ? PROVENANCE.dataset.replace(/, compiled from India Code.*$/, ", compiled from regulator websites") : PROVENANCE.dataset}</a>. Snapshot {PROVENANCE.snapshot}. Licence: {PROVENANCE.licence}.</p>
      <p>The text was extracted by machine from official documents. It can contain errors, gaps or scrambled characters, so every section shows a quality flag{sectionStatusLabel ? <> (this section: <strong className="font-medium text-foreground">{sectionStatusLabel}</strong>)</> : null}. {" "}{CHAPTER_NOTE} Not legal advice; check the official source.</p>
    </Notice>
  );
}

function Unavailable({ s, officialUrl, doc }: { s: Extract<TextState, { available: false }>; officialUrl: string; doc?: DocRef }) {
  const src = sourceInfo(doc ?? {}, officialUrl);
  const title = s.reason === "not_in_export" ? "Section text for this entry is not included yet" : s.reason === "unreadable" ? "Section text could not be loaded" : "Section text is not available yet";
  return (
    <Panel className="mt-6 text-center">
      <p className="text-ui-lead font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-[56ch] text-ui-base text-secondary">{s.message}{src ? ` You can read the official text on ${src.label}.` : ""}</p>
      {src && <a href={src.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-ui-base font-medium text-on-primary hover:bg-primary-hover">Open {src.label}</a>}
    </Panel>
  );
}

export default function ActTextView({ header, state }: { header: ActHeader; state: TextState }) {
  const view = state.available ? state.view : null;
  const unnumbered = view ? view.list.filter((i) => i.noNumber && !i.missing).length : 0, numbered = view ? view.counts.sections - unnumbered : 0;   // "N sections in our data": every numbered row, the dataset's and the India Code fill-ins
  const sel = view?.selected ?? null, dt = docTypeOf(header.doc ?? { title: header.title }), units = unitsWord(header.doc ?? { title: header.title }), src = sourceInfo(header.doc ?? { title: header.title }, view?.sourceUrl ?? header.officialUrl);
  const home = libraryHome(header.doc ?? { title: header.title });
  const contents = view ? (
<Panel className="p-0">
      <p className="border-b border-border/70 px-4 py-3 text-ui-sm text-secondary" role="status">
        {view.counts.sections > 0 && view.counts.sections === view.counts.supplemented ? `${fmt(view.counts.sections)} Articles and Schedules, all read from India Code's text PDF of this Act.` : <>
        {view.hasSectionNumbers ? <>
          <strong className="font-medium">{fmt(numbered)} {units} in our data</strong>: {fmt(numbered - view.counts.supplemented)} from the open-india-law dataset{view.counts.supplemented ? ` and ${fmt(view.counts.supplemented)} filled in from India Code` : ""}{unnumbered ? `, plus ${fmt(unnumbered)} text block without a section number` : ""}. Dataset text ({fmt(view.counts.sections - view.counts.supplemented)} blocks): {fmt(view.counts.complete)} no problems detected, {fmt(view.counts.possibly_incomplete)} possibly incomplete, {fmt(view.counts.garbled)} unreliable{view.counts.missing ? `. ${fmt(view.counts.missing)} missing from our source data` : ""}.
        </> : <>
          {fmt(view.counts.sections - view.counts.supplemented)} text blocks: {fmt(view.counts.complete)} no problems detected, {fmt(view.counts.possibly_incomplete)} possibly incomplete, {fmt(view.counts.garbled)} unreliable{view.counts.supplemented ? `, ${fmt(view.counts.supplemented)} filled in from India Code` : ""}{view.counts.missing ? `, ${fmt(view.counts.missing)} missing from our source data` : ""}.
        </>}
        </>}
      </p>
      {view.hasSchedule && (
        <Link href={href(header.actId, "schedule")} aria-current={view.schedule ? "true" : undefined} className={`flex min-h-11 items-center border-b border-border/70 px-4 py-2 text-ui-base text-primary hover:bg-accent ${view.schedule ? "bg-accent font-medium" : ""}`}>Schedule as a table</Link>
      )}
      <ul className="max-h-[70vh] overflow-y-auto py-1 lg:max-h-none lg:overflow-visible">
        {view.list.map((it, n) => {
          const active = !view.schedule && it.key === sel?.key, newGroup = !!it.group && it.group !== view.list[n - 1]?.group;
          return (
            <Fragment key={it.key}>
            {newGroup && <li role="presentation" className="sticky top-0 bg-surface px-4 pb-1 pt-3 text-ui-xs font-semibold uppercase tracking-caps text-secondary">{it.group}</li>}
            <li>
              <Link href={href(header.actId, it.key)} aria-current={active ? "true" : undefined} className={`flex items-start gap-2 px-4 py-2 text-ui-base hover:bg-accent ${active ? "bg-accent font-medium" : ""}`}>
                <StatusDot tone={it.tone} />
                <span className="min-w-0"><span className="block truncate">{it.label}{it.heading ? ` · ${cleanLabel(it.heading)}` : ""}</span><span className="sr-only">{it.supplemented ? "Filled in from India Code" : it.statusLabel}</span></span>
              </Link>
            </li>
            </Fragment>
          );
        })}
      </ul>
    </Panel>
  ) : null;
  return (
    <div className="mx-auto max-w-w1280 pt-2">
      <nav aria-label="Breadcrumb" className="text-ui-base text-secondary">
        <Link href="/library" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Library</Link>
        <span aria-hidden> › </span><Link href={home.href} className="inline-flex min-h-8 items-center hover:text-primary hover:underline">{home.label}</Link>
      </nav>
      <h1 className="mt-2 font-serif text-ui-title font-semibold">{header.title}</h1>
      {view && <p className="mt-1"><RepealedNote actId={header.actId} /></p>}
      {!view && <p className="mt-2 flex flex-wrap items-center gap-1.5">{header.meta.map((m) => <Badge key={m}>{m}</Badge>)}<RepealedNote actId={header.actId} /></p>}

      {!view && <div className="mt-5"><ProvenanceNote sectionStatusLabel={sel?.statusInfo.label} doc={header.doc} /></div>}

      {!state.available && <Unavailable s={state} officialUrl={header.officialUrl} doc={header.doc} />}

      {view && (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_17rem]">
          <details className="rounded-card bg-surface ring-1 ring-border/60 lg:hidden"><summary className="min-h-11 cursor-pointer px-4 py-3 text-ui-base font-medium">Contents ({fmt(view.list.length)})</summary><div className="border-t border-border/70">{contents}</div></details>
          <aside aria-label="Contents of this document" className="hidden lg:sticky lg:top-header lg:block lg:max-h-sticky lg:self-start lg:overflow-y-auto">{contents}</aside>

          <article aria-labelledby="sec-title">
            {!view.hasSectionNumbers && <Notice tone="warn" title={`${dt.unit} numbers are not available for this document`} className="mb-4"><p>The dataset has no numbers for its parts, so its text is shown as unnumbered blocks in the dataset&apos;s order.</p></Notice>}
            {view.schedule ? <ScheduleTableView table={view.schedule} actTitle={header.title} /> : sel ? (
              <Panel>
                <h2 id="sec-title" className="text-ui-lead font-semibold">{view.hasSectionNumbers && (sel.key.startsWith("s") || sel.missing) && !/^(Order |Article |[A-Z][a-z]+ Schedule$)/.test(sel.label) ? `${dt.unit} ${sel.label}` : sel.label}{sel.heading && sel.heading !== sel.label ? ` — ${cleanLabel(sel.heading)}` : ""}</h2>
                {sel.chapter && <p className="mt-1 text-ui-sm text-secondary">{cleanLabel(sel.chapter)}</p>}
                {sel.missing && (
                  <Notice tone="warn" role="status" className="mt-4">
                    <p className="font-medium text-foreground">{sel.note ? sel.note.replace(/ — check India Code\.?$/, "") : MISSING_NOTICE.replace(" Read it on India Code.", "")} <a className="underline" href={src?.url ?? view.sourceUrl} target="_blank" rel="noopener noreferrer">{sel.note ? `Check ${src?.label ?? "the original"}` : `Read it on ${src?.label ?? "the original"}`}</a>.</p>
                  </Notice>
                )}
                {/^Article /.test(sel.label) && /Stamp Act/i.test(header.title) && <Notice tone="warn" role="note" compact className="mt-3"><p>{STAMP_NOTE}</p></Notice>}
                {sel.supplement && (
                  <Notice tone="info" role="note" compact className="mt-3">
                    <p><strong className="font-medium text-foreground">Source: {sel.supplement.source}, copied {fmtDate(sel.supplement.copiedOn)}.</strong> {/^(Order |Article |[A-Z][a-z]+ Schedule$)/.test(sel.label) ? (/Constitution/.test(header.title) ? "This text was read from India Code's text PDF of the Constitution." : "This part of the Act's Schedule was read from India Code's Act PDF.") : "This section was copied by hand to fill a gap in our source data."} <a className="underline" href={sel.supplement.sourceUrl} target="_blank" rel="noopener noreferrer">Open the page it was copied from</a>. The official text prevails; not legal advice.</p>
                  </Notice>
                )}
                {sel.missing ? null : sel.blocks === null ? (
                  <Notice tone="bad" title="Text for this section is unreliable in the source dataset" role="status" className="mt-4">
                    <p>These characters could not be checked, or were scrambled when the source was extracted, so we do not show them.</p>
                    {src && <p><a className="underline" href={src.url} target="_blank" rel="noopener noreferrer">Read the original on {src.label}</a></p>}
                  </Notice>
                ) : (
                  <MarkedPage className="mt-4 space-y-3 font-reading text-reading leading-reading" label="Selected section">
                    {(() => { const vocab = vocabOf(sel.blocks.map((x) => x.text)); return sel.blocks.map((b, i) => (b.type === "heading" ? <h3 key={i} className="pt-2 font-sans text-ui-base font-semibold uppercase tracking-wide text-secondary">{b.text}</h3> : <p key={i}><DisplayText text={b.text} vocab={vocab} /></p>)); })()}
                  </MarkedPage>
                )}

                <nav aria-label="Previous and next section" className="mt-6 flex items-center justify-between border-t border-border/70 pt-4 text-ui-base">
                  {sel.prev ? <Link className={buttonClass("secondary", "md", "text-primary")} href={href(header.actId, sel.prev.key)}>← {sel.prev.label}</Link> : <span />}
                  {sel.next ? <Link className={buttonClass("secondary", "md", "text-primary")} href={href(header.actId, sel.next.key)}>{sel.next.label} →</Link> : <span />}
                </nav>
              </Panel>
            ) : view.notFound ? (
              <Notice tone="warn" role="status" title="Section not found in our data"><p>This Act has no section with that number in our data. Choose a section from the list.</p></Notice>
            ) : (
              <Panel><p className="text-ui-base text-secondary">This Act has no text in the export.</p></Panel>
            )}
          </article>
          <aside aria-label="Notes about this text" className="space-y-3 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-header xl:max-h-sticky xl:self-start xl:overflow-y-auto">
            <Panel className="space-y-2 text-ui-sm">
              <h2 className="text-ui-xs font-semibold uppercase tracking-caps text-muted">This section</h2>
              {sel && !sel.missing && !sel.supplement && <p className="flex flex-wrap items-center gap-1.5"><Badge tone={sel.statusInfo.tone} title={sel.statusInfo.explain}>{sel.statusInfo.label}</Badge>{sel.flags.map((f) => <Badge key={f.key} tone={f.info.tone} title={f.info.explain}>{f.info.label}</Badge>)}</p>}
              {sel?.supplement && <p className="text-secondary">Filled in from India Code, copied {fmtDate(sel.supplement.copiedOn)}.</p>}
              {sel?.status === "possibly_incomplete" && !sel.supplement && <p className="text-secondary">{INCOMPLETE_NOTICE} Built from {sel.chunkCount} piece{sel.chunkCount === 1 ? "" : "s"} of the dataset.</p>}
              {sel?.missing && <p className="text-secondary">Not in our library yet.</p>}
              {src && <p><a className="font-medium text-primary underline" href={src.url} target="_blank" rel="noopener noreferrer">Open the original on {src.label} ›</a></p>}
            </Panel>
            <Panel className="space-y-2 text-ui-sm">
              <h2 className="text-ui-xs font-semibold uppercase tracking-caps text-muted">This Act</h2>
              <p className="flex flex-wrap items-center gap-1.5">{header.meta.map((m) => <Badge key={m}>{m}</Badge>)}<RepealedNote actId={header.actId} /></p>
              <p className="text-secondary">{view.hasSectionNumbers ? `${fmt(numbered)} ${units} in our data.` : "Text blocks without numbers."}{view.counts.possibly_incomplete ? ` ${fmt(view.counts.possibly_incomplete)} possibly incomplete.` : ""}{view.counts.missing ? ` ${fmt(view.counts.missing)} not in our library yet.` : ""}</p>
            </Panel>
            <ProvenanceNote sectionStatusLabel={sel?.statusInfo.label} doc={header.doc} />
          </aside>
        </div>
      )}
    </div>
  );
}
