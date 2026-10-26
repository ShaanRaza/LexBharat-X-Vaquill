import type { ReactNode } from "react";

// "The marked page": the cited or selected passage is lifted to white with a forest outline and corner handles, while the text around it dims (see .marked and .marked-scope in globals.css).
// The mark never relies on colour alone: outline + handles + (for assistive tech) the label. Wrap the passage in <MarkedPage>; wrap its surroundings in <MarkedScope> so they dim.
export default function MarkedPage({ children, label = "Marked passage", as: Tag = "div", className = "", id }: { children: ReactNode; label?: string; as?: "div" | "section" | "article"; className?: string; id?: string }) {
  return <Tag id={id} className={`marked ${className}`} data-marked="true"><span className="sr-only">{label}: </span>{children}</Tag>;
}
export function MarkedScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`marked-scope ${className}`}>{children}</div>;
}
