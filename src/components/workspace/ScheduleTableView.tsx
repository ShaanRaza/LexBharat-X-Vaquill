import { Fragment } from "react";
import { Notice, Panel } from "@/components/kit";
import type { ScheduleTable } from "@/lib/acts/scheduleTable.mjs";

// Presentation only: the rows arrive ready-made from src/lib/acts/scheduleTable.mjs. Colours, sizes and radii come from the shared tokens.
export const STAMP_NOTE = "These are the Central Government's rates as printed in the Act's PDF. Most States have their own rates (and the printed rates are old), so check the State's current schedule before relying on them.";

export default function ScheduleTableView({ table, actTitle }: { table: ScheduleTable; actTitle: string }) {
  const cols = table.columns ?? [];
  return (
    <Panel>
      <h2 id="sec-title" className="text-ui-lead font-semibold">{table.title}</h2>
      <p className="mt-1 text-ui-sm text-secondary">{actTitle}. Each row is one Article, read from India Code&apos;s PDF; open an Article in the list to see it on its own.</p>
      {table.kind === "stamp" && <Notice tone="warn" role="note" compact className="mt-3"><p>{STAMP_NOTE}</p></Notice>}
      {/* phones: one card per Article (a four-column table does not fit) */}
      <ul className="mt-4 space-y-2 md:hidden" aria-label={table.title}>
        {table.rows.map((r) => (
          <li key={r.article}>
            {r.startsGroup && r.group && <p className="mb-2 mt-3 text-ui-xs font-semibold uppercase tracking-wide text-secondary">{r.group}</p>}
            <div id={`article-m-${r.article}`} className="rounded-panel bg-surface p-3 ring-1 ring-border">
              <p className="text-ui-base font-semibold">Article {r.article}</p>
              <dl className="mt-1 space-y-1.5 text-ui-base">
                {cols.slice(1).map((c, i) => <div key={c}><dt className="text-ui-xs text-secondary">{c}</dt><dd>{r.cells[i] || "—"}</dd></div>)}
              </dl>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 hidden overflow-x-auto rounded-panel ring-1 ring-border md:block" tabIndex={0} role="region" aria-label={`${table.title}, scrollable table`}>
        <table className="w-full min-w-[640px] border-collapse text-left text-ui-base">
          <thead className="bg-accent text-ui-sm text-secondary">
            <tr>{cols.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <Fragment key={r.article}>
                {r.startsGroup && r.group && <tr><th scope="colgroup" colSpan={cols.length} className="bg-accent/60 px-3 py-2 text-ui-sm font-semibold uppercase tracking-wide text-secondary">{r.group}</th></tr>}
                <tr id={`article-${r.article}`} className="border-t border-border/70 align-top">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 font-medium">{r.article}</th>
                  {r.cells.map((c, i) => <td key={i} className="px-3 py-2">{c || "—"}</td>)}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
