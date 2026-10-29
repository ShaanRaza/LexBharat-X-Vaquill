import Link from "next/link";
import { Fragment } from "react";
import { Notice, Panel } from "@/components/kit";
import type { SectionListItem } from "@/lib/acts/viewModel";
import { cleanLabel } from "@/lib/text/clean.mjs";

// Library > Constitution: Parts and Articles as a contents list, each Article linking to its page. Server-rendered from the Act's section list (src/lib/legal-data). Presentation only.
export default function ConstitutionContents({ actId, items }: { actId: string; items: SectionListItem[] | null }) {
  if (!items?.length) return <Notice tone="info" role="status" className="mt-5"><p>The Constitution text is not available on this server.</p></Notice>;
  return (
    <div className="mt-5">
      <p className="text-ui-base text-secondary">Parts and Articles of the Constitution of India. Open an Article to read it, with the passage marked.</p>
      <Panel className="mt-4">
        <ul className="columns-1 gap-8 text-ui-base sm:columns-2">
          {items.map((it, i) => (
            <Fragment key={it.key}>
              {it.group && it.group !== items[i - 1]?.group && <li className="mt-4 break-after-avoid font-serif text-ui-body font-semibold first:mt-0">{it.group}</li>}
              <li className="py-0.5"><Link href={`/law/${actId}/${encodeURIComponent(it.key)}`} className="text-primary hover:underline">{it.label}{it.heading ? ` — ${cleanLabel(it.heading)}` : ""}</Link></li>
            </Fragment>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
