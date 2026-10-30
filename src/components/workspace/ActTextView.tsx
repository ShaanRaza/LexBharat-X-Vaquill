import Link from "next/link";
import { Fragment } from "react";
import { Badge, Notice, Panel, RepealedNote, StatusDot } from "@/components/kit";
import { PROVENANCE, CHAPTER_NOTE, INCOMPLETE_NOTICE, MISSING_NOTICE } from "@/lib/acts/quality";
import type { ActTextView as View } from "@/lib/acts/viewModel";
import ScheduleTableView, { STAMP_NOTE } from "./ScheduleTableView";

// Presentation only: every value arrives ready-made from src/lib/acts/viewModel.ts. Colours, sizes and radii come from the shared tokens (Tailwind names + kit components).
export type ActHeader = { actId: string; title: string; meta: string[]; officialUrl: string };
export type TextState = { available: true; view: View } | { available: false; reason: "not_configured" | "not_in_export" | "unreadable"; message: string };

const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const href = (actId: string, key: string) => `/workspace/browse/acts/${actId}?section=${encodeURIComponent(key)}`;

/** Shown on every Acts text page, whether or not text is available. */
export function ProvenanceNote({ sectionStatusLabel }: { sectionStatusLabel?: string }) {
  return (
    <Notice title="Where this text comes from" role="note">
      <p>Source dataset: <a className="underline" href={PROVENANCE.datasetUrl} target="_blank" rel="noopener noreferrer">{PROVENANCE.dataset}</a>. Snapshot {PROVENANCE.snapshot}. Licence: {PROVENANCE.licence}.</p>
      <p>Data sources and permissions: the Act text comes from open-india-law (CC BY 4.0) and from India Code, whose text is republished with written permission.</p>
      <p>The text was extracted by machine from official documents. It can contain errors, gaps or scrambled characters, so every section shows a quality flag{sectionStatusLabel ? <> (this section: <strong className="font-medium text-foreground">{sectionStatusLabel}</strong>)</> : null}. {" "}{CHAPTER_NOTE} Not legal advice; check the official source.</p>
    </Notice>
  );
}

function Unavailable({ s, officialUrl }: { s: Extract<TextState, { available: false }>; officialUrl: string }) {
  const title = s.reason === "not_in_export" ? "Section text for this entry is not included yet" : s.reason === "unreadable" ? "Section text could not be loaded" : "Section text is not available yet";
  return (
    <Panel className="mt-6 text-center">
      <p className="text-ui-lead font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-[56ch] text-ui-base text-secondary">{s.message} You can read the official text on India Code.</p>
      <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-ui-base font-medium text-on-primary hover:bg-primary-hover">Open India Code</a>
    </Panel>
  );
}

export default function ActTextView({ header, state }: { header: ActHeader; state: TextState }) {
  const view = state.available ? state.view : null;
  const sel = view?.selected ?? null;
  return (
    <div className="mx-auto max-w-w1040 pt-2">
      <nav aria-label="Breadcrumb" className="text-ui-base text-secondary">
        <Link href="/workspace/browse?tab=acts" className="inline-flex min-h-8 items-center hover:text-primary hover:underline">Browse Laws &amp; Judgments</Link>
        <span aria-hidden> / </span><span>Acts &amp; Legislation</span>
      </nav>
      <h1 className="mt-2 text-ui-title font-semibold">{header.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-1.5">{header.meta.map((m) => <Badge key={m}>{m}</Badge>)}<RepealedNote actId={header.actId} /></p>

      <div className="mt-5"><ProvenanceNote sectionStatusLabel={sel?.statusInfo.label} /></div>

      {!state.available && <Unavailable s={state} officialUrl={header.officialUrl} />}

      {view && (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside aria-label="Sections of this Act" className="lg:sticky lg:top-4 lg:self-start">
            <Panel className="p-0">
              <p className="border-b border-border/70 px-4 py-3 text-ui-sm text-secondary" role="status">
                {view.counts.sections > 0 && view.counts.sections === view.counts.supplemented ? `${fmt(view.counts.sections)} Articles and Schedules, all read from India Code's text PDF of this Act.` : <>
                {fmt(view.counts.sections - view.counts.supplemented)} {view.hasSectionNumbers ? "sections" : "text blocks"}: {fmt(view.counts.complete)} no problems detected, {fmt(view.counts.possibly_incomplete)} possibly incomplete, {fmt(view.counts.garbled)} unreliable{view.counts.supplemented ? `, ${fmt(view.counts.supplemented)} filled in from India Code` : ""}{view.counts.missing ? `, ${fmt(view.counts.missing)} missing from our source data` : ""}.
                </>}
              </p>
              {view.hasSchedule && (
                <Link href={href(header.actId, "schedule")} aria-current={view.schedule ? "true" : undefined} className={`flex min-h-11 items-center border-b border-border/70 px-4 py-2 text-ui-base text-primary hover:bg-accent ${view.schedule ? "bg-accent font-medium" : ""}`}>Schedule as a table</Link>
              )}
              <ul className="max-h-[70vh] overflow-y-auto py-1">
                {view.list.map((it, n) => {
                  const active = !view.schedule && it.key === sel?.key, newGroup = !!it.group && it.group !== view.list[n - 1]?.group;
                  return (
                    <Fragment key={it.key}>
                    {newGroup && <li role="presentation" className="sticky top-0 bg-surface px-4 pb-1 pt-3 text-ui-xs font-semibold uppercase tracking-caps text-secondary">{it.group}</li>}
                    <li>
                      <Link href={href(header.actId, it.key)} aria-current={active ? "true" : undefined} className={`flex items-start gap-2 px-4 py-2 text-ui-base hover:bg-accent ${active ? "bg-accent font-medium" : ""}`}>
                        <StatusDot tone={it.tone} />
                        <span className="min-w-0"><span className="block truncate">{it.label}{it.heading ? ` · ${it.heading}` : ""}</span><span className="sr-only">{it.supplemented ? "Filled in from India Code" : it.statusLabel}</span></span>
                      </Link>
                    </li>
                    </Fragment>
                  );
                })}
              </ul>
            </Panel>
          </aside>

          <article aria-labelledby="sec-title">
            {!view.hasSectionNumbers && <Notice tone="warn" title="Section numbers are not available for this Act" className="mb-4"><p>The dataset has no section numbers for it, so its text is shown as unnumbered blocks in the dataset&apos;s order.</p></Notice>}
            {view.schedule ? <ScheduleTableView table={view.schedule} actTitle={header.title} /> : sel ? (
              <Panel>
                <h2 id="sec-title" className="text-ui-lead font-semibold">{view.hasSectionNumbers && (sel.key.startsWith("s") || sel.missing) && !/^(Order |Article |[A-Z][a-z]+ Schedule$)/.test(sel.label) ? `Section ${sel.label}` : sel.label}{sel.heading && sel.heading !== sel.label ? ` — ${sel.heading}` : ""}</h2>
                {sel.chapter && <p className="mt-1 text-ui-sm text-secondary">{sel.chapter}</p>}
                {sel.missing && (
                  <Notice tone="warn" role="status" className="mt-4">
                    <p className="font-medium text-foreground">{sel.note ? sel.note.replace(/ — check India Code\.?$/, "") : MISSING_NOTICE.replace(" Read it on India Code.", "")} <a className="underline" href={view.sourceUrl} target="_blank" rel="noopener noreferrer">{sel.note ? "Check India Code" : "Read it on India Code"}</a>.</p>
                  </Notice>
                )}
                {/^Article /.test(sel.label) && /Stamp Act/i.test(header.title) && <Notice tone="warn" role="note" compact className="mt-3"><p>{STAMP_NOTE}</p></Notice>}
                {sel.supplement && (
                  <Notice tone="info" role="note" compact className="mt-3">
                    <p><strong className="font-medium text-foreground">Source: {sel.supplement.source}, copied {fmtDate(sel.supplement.copiedOn)}.</strong> {/^(Order |Article |[A-Z][a-z]+ Schedule$)/.test(sel.label) ? (/Constitution/.test(header.title) ? "This text was read from India Code's text PDF of the Constitution." : "This part of the Act's Schedule was read from India Code's Act PDF.") : "This section was copied by hand to fill a gap in our source data."} <a className="underline" href={sel.supplement.sourceUrl} target="_blank" rel="noopener noreferrer">Open the page it was copied from</a>. The official text prevails; not legal advice.</p>
                  </Notice>
                )}
                {!sel.missing && !sel.supplement && <p className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={sel.statusInfo.tone} title={sel.statusInfo.explain}>{sel.statusInfo.label}</Badge>
                  {sel.flags.map((f) => <Badge key={f.key} tone={f.info.tone} title={f.info.explain}>{f.info.label}</Badge>)}
                </p>}
                {sel.status === "possibly_incomplete" && !sel.supplement && (
                  <Notice tone="warn" role="status" title="This section may be incomplete" className="mt-3">
                    <p>{INCOMPLETE_NOTICE} <a className="font-medium underline" href={view.sourceUrl} target="_blank" rel="noopener noreferrer">Open this Act on India Code</a></p>
                    <p className="text-ui-sm">Built from {sel.chunkCount} piece{sel.chunkCount === 1 ? "" : "s"} of the dataset.</p>
                  </Notice>
                )}

                {sel.missing ? null : sel.blocks === null ? (
                  <Notice tone="bad" title="Text for this section is unreliable in the source dataset" role="status" className="mt-4">
                    <p>These characters could not be checked, or were scrambled when the source was extracted, so we do not show them.</p>
                    <p><a className="underline" href={view.sourceUrl} target="_blank" rel="noopener noreferrer">Read this Act on India Code</a></p>
                  </Notice>
                ) : (
                  <div className="mt-4 space-y-3 font-reading text-ui-lead leading-reading">
                    {sel.blocks.map((b, i) => (b.type === "heading" ? <h3 key={i} className="pt-2 font-sans text-ui-base font-semibold uppercase tracking-wide text-secondary">{b.text}</h3> : <p key={i}>{b.text}</p>))}
                  </div>
                )}

                <nav aria-label="Previous and next section" className="mt-6 flex items-center justify-between border-t border-border/70 pt-4 text-ui-base">
                  {sel.prev ? <Link className="rounded-panel px-3 py-2 text-primary ring-1 ring-border hover:bg-accent" href={href(header.actId, sel.prev.key)}>← {sel.prev.label}</Link> : <span />}
                  {sel.next ? <Link className="rounded-panel px-3 py-2 text-primary ring-1 ring-border hover:bg-accent" href={href(header.actId, sel.next.key)}>{sel.next.label} →</Link> : <span />}
                </nav>
              </Panel>
            ) : (
              <Panel><p className="text-ui-base text-secondary">This Act has no text in the export.</p></Panel>
            )}
          </article>
        </div>
      )}
    </div>
  );
}
