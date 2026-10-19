// MOCK ENDPOINT: looks the citation up in the tiny made-up corpus (src/data/corpus.ts).
// There is no database and no real citation resolver behind this.
import { corpus, findByCite } from "@/data/corpus";

export async function GET(req: Request) {
  const cite = new URL(req.url).searchParams.get("cite") ?? "42 U.S.C. § 1983";
  const hit = findByCite(cite) ?? corpus[0];
  return Response.json({
    _mock: true,
    _note: "Simulated response. Placeholder text, not real statute text.",
    matched: hit.cite === cite || !!findByCite(cite),
    cite: hit.cite,
    title: hit.title,
    jurisdiction: hit.jurisdiction,
    status: hit.status,
    edition: hit.edition,
    excerpt: hit.excerpt,
    last_amended: { year: hit.lastAmended, count: 2 },
    id: hit.id,
  });
}
