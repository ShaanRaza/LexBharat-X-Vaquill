// Class strings for form controls and buttons, written once with tokens only (colours, radii and sizes come from src/styles/tokens.css through Tailwind names).
// A control's outline uses `control-border` (>= 4.5:1 on the page and on white); `border` is only for decorative hairlines.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet";
export type ButtonSize = "sm" | "md" | "lg";
const BASE = "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface text-foreground ring-1 ring-control-border hover:bg-accent",
  ghost: "text-primary hover:bg-accent",
  quiet: "text-secondary hover:bg-accent hover:text-foreground",
};
const SIZE: Record<ButtonSize, string> = { sm: "h-8 px-3 text-ui-sm", md: "h-10 px-4 text-ui-base", lg: "h-11 px-5 text-ui-body" };
export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra = "") => `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim();

/** Single-line text field. */
export const fieldClass = "h-10 w-full rounded-input bg-surface px-3 text-ui-body text-foreground ring-1 ring-control-border placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary";
/** Native select, with a visible accent when it differs from its default. */
export const selectClass = (active = false) => `h-10 rounded-input px-3 text-ui-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-primary ${active ? "bg-accent font-medium ring-2 ring-primary" : "bg-surface ring-1 ring-control-border"}`;
/** One option of a toggle group (pill); `on` = the selected option. */
export const toggleClass = (on: boolean) => `inline-flex h-8 items-center rounded-button px-3 text-ui-sm focus-visible:outline-2 focus-visible:outline-primary ${on ? "bg-primary font-medium text-on-primary" : "bg-surface text-secondary ring-1 ring-control-border hover:bg-accent"}`;
