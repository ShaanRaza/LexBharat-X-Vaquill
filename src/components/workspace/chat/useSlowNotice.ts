"use client";
import { useEffect, useState } from "react";

/** True once `active` has been true for `ms` without a break: used to tell the user a slow answer is still on its way. Logic only. */
export function useSlowNotice(active: boolean, ms: number): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), ms); return () => clearTimeout(t);
  }, [active, ms]);
  return slow;
}
