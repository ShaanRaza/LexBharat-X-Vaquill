"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Notice, Panel } from "@/components/kit";
import { departmentLabel } from "@/lib/acts/departments.mjs";

// Library > Regulators: the regulators, Law Commission and tribunals whose instruments we hold; each opens the list of their instruments. Presentation and one fetch (/api/acts/stats).
export default function RegulatorsList() {
  const [deps, setDeps] = useState<string[] | null>(null), [err, setErr] = useState(false);
  useEffect(() => { fetch("/api/acts/stats").then((r) => (r.ok ? r.json() : Promise.reject())).then((j) => setDeps((j.departments as string[]) ?? [])).catch(() => setErr(true)); }, []);
  return (
    <div className="mt-5">
      {err && <Notice tone="bad" role="alert"><p>The list of regulators could not be loaded. Reload the page.</p></Notice>}
      {!deps && !err && <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="console-skel h-14 rounded-card bg-accent" />)}</div>}
      {deps && !deps.length && <Notice tone="info" role="status"><p>No regulator instruments are listed on this server.</p></Notice>}
      {deps && deps.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {deps.map((d) => <Panel as="li" key={d} className="px-card py-3"><Link href={`/library?tab=acts&category=regulatory&department=${encodeURIComponent(d)}`} className="text-ui-body font-medium text-primary hover:underline">{departmentLabel(d) ?? d}</Link></Panel>)}
        </ul>
      )}
      <p className="mt-4 text-ui-sm text-muted">Regulator instruments are searched by keyword on the Search page (Regulators tab).</p>
    </div>
  );
}
