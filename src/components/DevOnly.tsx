import { RELEASE } from "@/lib/release";

/** Renders its children only in demo mode. Wrap any dev/demo-only note or paragraph in this. */
export default function DevOnly({ children }: { children: React.ReactNode }) {
  return RELEASE ? null : <>{children}</>;
}
