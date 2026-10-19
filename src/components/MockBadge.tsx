// Visible label for anything simulated, so it is never mistaken for a real backend.
import { RELEASE } from "@/lib/release";
export default function MockBadge({ children = "MOCK" }: { children?: React.ReactNode }) {
  if (RELEASE) return null;
  return (
    <span className="inline-block rounded-control border border-warning/40 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-warning">
      {children}
    </span>
  );
}
