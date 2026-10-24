// GET /api/admin/feedback-csv -> every feedback row as a CSV file. Needs the admin cookie.
import { ADMIN_COOKIE, cookieOf, isAdminCookie } from "@/lib/insights/admin";
import { allFeedback, insightsConfigured } from "@/lib/insights/server";
import { toCsv } from "@/lib/insights/rules.mjs";

export async function GET(req: Request) {
  if (!(await isAdminCookie(cookieOf(req, ADMIN_COOKIE)))) return Response.json({ error: "Admin password required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!insightsConfigured()) return Response.json({ error: "Not set up." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const rows = (await allFeedback().catch(() => [])).map((r) => ({ ...r, question: r.snapshot?.question ?? "", answer: r.snapshot?.answer ?? "", citations: r.snapshot?.citations ?? [], detail: r.snapshot && !r.snapshot.question ? [r.snapshot.title, r.snapshot.template, r.snapshot.contractType, r.snapshot.side].filter(Boolean).join(" / ") : "" }));
  const csv = toCsv([{ key: "created_at", label: "First vote" }, { key: "updated_at", label: "Last changed" }, { key: "feature", label: "Feature" }, { key: "vote", label: "Vote" }, { key: "reasons", label: "Reasons" }, { key: "comment", label: "Comment" },
    { key: "model", label: "Model" }, { key: "question", label: "Question" }, { key: "answer", label: "Answer" }, { key: "citations", label: "Citations" }, { key: "detail", label: "Draft / review" }], rows);
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="lexbharat-feedback.csv"', "Cache-Control": "no-store" } });
}
