// Plain-text index of the docs, like the public docs' llms.txt. Generated from the local sidebar data.
import { docsNav } from "@/data/docs/nav";
import { RELEASE } from "@/lib/release";

export function GET() {
  const lines = RELEASE ? ["# LexBharat", ""] : ["# LexBharat (local mock)", "", "> Local recreation of an API documentation index. Pages are placeholders; see docs/ASSUMPTIONS-AND-UNKNOWNS.md.", ""];
  for (const s of docsNav) {
    lines.push(`## ${s.title}`, ...s.pages.map((p) => `- [${p.title}](/docs/${p.slug})`), "");
  }
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
