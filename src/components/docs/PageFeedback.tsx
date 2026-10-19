"use client";
import { useState } from "react";

/** "Was this page helpful?" Yes / No. LOCAL ONLY: the answer is kept in component state and sent nowhere. */
export default function PageFeedback() {
  const [v, setV] = useState<"" | "yes" | "no">("");
  const btn = "inline-flex h-9 min-w-[64px] items-center justify-center rounded-xl border border-border bg-surface px-4 text-[14px] transition-colors hover:bg-raised aria-pressed:border-primary aria-pressed:text-primary";
  return (
    <div className="flex flex-wrap items-center gap-3 text-[14px] text-[#535151]">
      <span id="helpful-q">Was this page helpful?</span>
      <div role="group" aria-labelledby="helpful-q" className="flex gap-2">
        <button type="button" className={btn} aria-pressed={v === "yes"} onClick={() => setV("yes")}>Yes</button>
        <button type="button" className={btn} aria-pressed={v === "no"} onClick={() => setV("no")}>No</button>
      </div>
      <span role="status" className="text-muted">{v ? "Thanks for the feedback (not stored; this is a local build)." : ""}</span>
    </div>
  );
}
