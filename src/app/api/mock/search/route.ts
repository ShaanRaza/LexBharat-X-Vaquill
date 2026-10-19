// MOCK ENDPOINT: keyword search over the tiny made-up corpus. Real relevance ranking is not implemented.
import { search } from "@/data/corpus";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { query?: string; corpusType?: string; state?: string };
  const results = search(b.query ?? "", { corpus: b.corpusType || undefined, jurisdiction: b.state || undefined });
  return Response.json({ _mock: true, query: b.query ?? "", total: results.length, results });
}
