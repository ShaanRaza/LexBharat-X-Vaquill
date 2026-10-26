import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./controls";

// The one button. Variant is a meaning (primary / secondary / ghost / quiet); how it looks is decided in controls.ts from the tokens. With `href` it renders a link that looks the same.
type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };
export default function Button(props: Common & (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined } | { href: string; "aria-label"?: string; title?: string })) {
  const { variant = "secondary", size = "md", className = "", children, ...rest } = props as Common & Record<string, unknown>;
  const cls = buttonClass(variant, size, className);
  if ("href" in rest && typeof rest.href === "string") return <Link href={rest.href} className={cls} {...(rest as object)}>{children}</Link>;
  return <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>;
}
