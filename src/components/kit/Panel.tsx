import type { ReactNode } from "react";

// Shared card surface used by list rows and detail blocks.
export default function Panel({ children, as: Tag = "section", className = "", ...rest }: { children: ReactNode; as?: "section" | "div" | "li" | "article"; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={`rounded-card bg-surface p-card shadow-sm ring-1 ring-border/60 ${className}`} {...(rest as object)}>{children}</Tag>;
}
