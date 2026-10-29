// Used only by `npm run ui-sweep` (which starts the server with UI_SWEEP=1): throws on purpose so the sweep can look at the error page (src/app/error.tsx). Anywhere else it is a plain 404.
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default function SweepError() {
  if (process.env.UI_SWEEP !== "1") notFound();
  throw new Error("ui-sweep: deliberate error to look at the error page");
}
