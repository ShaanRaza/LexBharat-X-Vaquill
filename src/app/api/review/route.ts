// GET /api/review -> this browser's saved reviews, usage and limits. POST /api/review {docId, contractType, side} -> checks the limits and the document (a Ready document of this browser), saves a new review and
// returns its id; the page then calls /api/review/<id>/step until it is done. Reviews are counted when they start and the count is given back if every part fails.
import { aiConfigured } from "@/lib/ai";
import limitConfig from "@/config/review-limits.json";
import { evaluateLimits, readLimits } from "@/lib/chat/limits.mjs";
import { bidOf, envOf, json, NOT_SET_UP, vaultReady } from "@/lib/vault/http";
import { addUsage, getDoc, getText, scanPageNumbers, usageCounts } from "@/lib/vault/store";
import { NOT_A_CONTRACT, looksLikeContract } from "@/lib/review/reasons.mjs";
import { isContractType, sideOk } from "@/lib/review/rules.mjs";
import { newResult } from "@/lib/review/run";
import { bump } from "@/lib/insights/server";
import { countRuns, createRun, listRuns } from "@/lib/review/store";

const limits = () => readLimits(limitConfig, envOf(), "REVIEW_LIMIT");

export async function GET(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  const l = limits(), shown = { daily: l.daily, weekly: l.weekly, maxSaved: limitConfig.maxSaved };
  if (!vaultReady()) return json({ ready: false, reviews: [], limits: shown, usage: { day: 0, week: 0 } });
  try { const [reviews, u] = await Promise.all([listRuns(bid), usageCounts(bid, "review")]); return json({ ready: aiConfigured("review"), reviews, limits: shown, usage: { day: u.day, week: u.week } }); }
  catch { return json({ ready: true, reviews: [], limits: shown, usage: { day: 0, week: 0 }, error: "Could not load your reviews." }, 503); }
}

export async function POST(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  if (!vaultReady()) return json(NOT_SET_UP, 503);
  if (!aiConfigured("review")) return json({ error: "Review is not set up yet (no model key)." }, 503);
  const b = (await req.json().catch(() => null)) as { docId?: unknown; contractType?: unknown; side?: unknown } | null;
  const type = String(b?.contractType ?? ""), side = String(b?.side ?? "");
  if (!isContractType(type)) return json({ error: "Choose the type of contract." }, 422);
  if (!sideOk(type, side)) return json({ error: "Choose which side you are on." }, 422);
  try {
    const doc = typeof b?.docId === "string" ? await getDoc(bid, b.docId) : null;
    if (!doc) return json({ error: "Choose a document from the Vault." }, 404);
    if (doc.status !== "ready") return json({ error: doc.status === "processing" ? "That document is still being prepared. Try again in a moment." : "That document can't be read, so it can't be reviewed." }, 422);
    if ((await countRuns(bid)) >= limitConfig.maxSaved) return json({ error: `You have ${limitConfig.maxSaved} saved reviews, the most this browser can keep. Delete one first.` }, 422);
    const verdict = evaluateLimits(await usageCounts(bid, "review"), limits(), "reviews");
    if (!verdict.allowed) { bump("limit_hit", `review_${verdict.reason}`); return json({ error: verdict.message, reason: verdict.reason }, 429); }
    const text = await getText(bid, doc.id); if (!text) return json({ error: "That document has no readable text." }, 422);
    if (!looksLikeContract(text.body).ok) { bump("review_refused", "not_contract"); return json({ error: NOT_A_CONTRACT, reason: "not_contract" }, 422); }   // stop early: nothing is saved or counted against the limits
    const usageId = await addUsage(bid, "review"), result = newResult(text.body, type, text.pageStarts);
    result.usageId = usageId;
    if (doc.scanned) result.scanPages = await scanPageNumbers(bid, doc.id);
    const id = await createRun(bid, { docId: doc.id, docName: doc.name, contractType: type, side, result });
    bump("review", type);
    return json({ id });
  } catch { return json({ error: "Could not start the review. Please try again." }, 503); }
}
