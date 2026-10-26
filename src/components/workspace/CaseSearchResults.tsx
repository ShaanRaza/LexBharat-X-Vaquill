"use client";
import HcSearchResults from "./HcSearchResults";
import JudgmentTextSearch from "./JudgmentTextSearch";
import ScSearchResults from "./ScSearchResults";

// Results of the browse-page search bar: the Supreme Court and the High Courts, grouped, with one statement of what is searched.
export default function CaseSearchResults({ q }: { q: string }) {
  return (
    <div className="mt-6" aria-live="polite">
      <h2 className="text-fs-20 font-semibold tracking-tight-soft">Cases matching &ldquo;{q}&rdquo;</h2>
      <p className="mt-1 text-fs-sm text-muted">Searches party names and case numbers as recorded in the dataset, across all years, newest first. The Supreme Court section at the end also searches inside the judgment text. A name may be missing or truncated where the source did not give it cleanly.</p>
      <ScSearchResults q={q} />
      <HcSearchResults q={q} />
      <JudgmentTextSearch q={q} />
    </div>
  );
}
