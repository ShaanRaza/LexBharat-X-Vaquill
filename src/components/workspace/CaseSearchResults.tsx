"use client";
import HcSearchResults from "./HcSearchResults";
import ScSearchResults from "./ScSearchResults";

// Results of the browse-page search bar: the Supreme Court and the High Courts, grouped, with one statement of what is searched.
export default function CaseSearchResults({ q }: { q: string }) {
  return (
    <div className="mt-6" aria-live="polite">
      <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Cases matching &ldquo;{q}&rdquo;</h2>
      <p className="mt-1 text-[13px] text-muted">Searches party names and case numbers as recorded in the dataset, across all years, newest first. It does not search the text of judgments, and a name may be missing or truncated where the source did not give it cleanly.</p>
      <ScSearchResults q={q} />
      <HcSearchResults q={q} />
    </div>
  );
}
