"use client";
// Loads one review and keeps it moving: while it is "running" it asks the server for the next step (a part of the contract, the summary, the law points) one at a time, and shows the saved result as it grows.
// A failed step stays failed until the user presses Retry. No markup here.
import { useCallback, useEffect, useRef, useState } from "react";
import { isTransientReason } from "@/lib/review/reasons.mjs";
import type { ReviewRun } from "@/lib/review/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A unit that failed only for a reason that may pass by itself (limit, outage, unusable reply; see isTransientReason): it is retried automatically (twice, after a pause) before the user is asked to press Retry. */
const BUSY = { test: (m: string) => isTransientReason(m) };
function busyUnit(run: ReviewRun): number | "summary" | "law" | undefined {
  const r = run.result; if (!r) return undefined;
  const p = r.parts.find((x) => x.status === "failed" && BUSY.test(x.error ?? "")); if (p) return p.i;
  if (r.summary.status === "failed" && BUSY.test(r.summary.error ?? "")) return "summary";
  if (r.law.status === "failed" && BUSY.test(r.law.error ?? "")) return "law";
  return undefined;
}
export function useReviewRun(id: string) {
  const [run, setRun] = useState<ReviewRun | null>(null), [err, setErr] = useState(""), [working, setWorking] = useState(false), retryNext = useRef<number | "summary" | "law" | undefined>(undefined), alive = useRef(true), loop = useRef(false);
  const [kick, setKick] = useState(0), [auto, setAuto] = useState(false), tries = useRef<Record<string, number>>({});
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { fetch(`/api/review/${id}`, { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error("This review was not found on this browser."); setRun((await r.json()).run); }).catch((e) => setErr(e.message)); }, [id]);
  const status = run?.status;
  useEffect(() => {
    if (status !== "running" && retryNext.current === undefined) return;
    if (loop.current) return; loop.current = true; setWorking(true);
    (async () => {
      let fails = 0;
      try {
        while (alive.current) {
          const retry = retryNext.current; retryNext.current = undefined;
          const r = await fetch(`/api/review/${id}/step`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(retry === undefined ? {} : { retry }) }).catch(() => null);
          if (!r || r.status === 503) { if (++fails > 3) { setErr("The review stopped because the server did not answer. Reload the page to continue."); break; } await sleep(4000); continue; }
          fails = 0; const j = await r.json().catch(() => ({}));
          if (!r.ok) { setErr(j.error || "Something went wrong."); break; }
          setRun(j.run);
          if (j.busy) { await sleep(2500); continue; }
          if (j.run.status !== "running" && retryNext.current === undefined) {
            const b = busyUnit(j.run), key = String(b);
            if (b !== undefined && (tries.current[key] ?? 0) < 2) { tries.current[key] = (tries.current[key] ?? 0) + 1; setAuto(true); await sleep(22000); setAuto(false); retryNext.current = b; continue; }
            break;
          }
          await sleep(800);
        }
      } finally { loop.current = false; if (alive.current) setWorking(false); }
    })();
  }, [status, id, kick]);
  const retry = useCallback((what: number | "summary" | "law") => { retryNext.current = what; setErr(""); setKick((k) => k + 1); setRun((r) => (r ? { ...r, status: "running" } : r)); }, []);
  return { run, err, working, retry, auto };
}
