import type { ReactNode } from "react";

// Small uppercase mono label led by a pilcrow ("¶ Section"), the design's kicker above titles and panels.
export default function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-ui-xs font-medium uppercase tracking-caps text-primary ${className}`}><span aria-hidden className="mr-1.5">¶</span>{children}</p>;
}
