#!/usr/bin/env node
// Re-ranks the table in docs/PDF-DOWNLOAD-LIST.md by real use: for each Act, the number of Supreme Court judgments that cite a section of it we lack (docs/coverage/act-citations.json, from coverage-priority.mjs),
// or, for an Act not in our library at all, the judgments that name it (the scan from sc-citations-scan.mjs). Rows keep their `#` (other docs refer to it); the order and the Pri column change; a "SC citations" column is added.
// usage: node scripts/acts/rerank-pdf-list.mjs <sc-citations.json>
import fs from "node:fs";
const scan = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), cov = JSON.parse(fs.readFileSync("docs/coverage/act-citations.json", "utf8"));
const norm = (t) => { const m = /^(.*?\b[12]\d{3})\b/.exec(t.replace(/\([^)]*\)/g, " ").replace(/\b(?:no\.?\s*)?\d{1,3}\s+of\s+(?=[12]\d{3}\b)/gi, " ")); return (m ? m[1] : t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, ""); };
const byTitle = new Map(cov.acts.map((a) => [norm(a.title), a]));
const lines = fs.readFileSync("docs/PDF-DOWNLOAD-LIST.md", "utf8").split("\n");
const h = lines.findIndex((l) => l.startsWith("| Pri |")); if (h < 0) throw new Error("table header not found");
let e = h + 2; while (e < lines.length && lines[e].startsWith("|")) e++;
const header = lines[h].split("|").map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
const rows = lines.slice(h + 2, e).map((l) => { const c = l.split("|").slice(1, -1).map((x) => x.trim()); const o = Object.fromEntries(header.map((k, i) => [k, c[i]])); o.raw = c; return o; });
const hasCol = header.includes("SC citations");
// Acts that need a download by the coverage rule and are not on the list yet are added (new rows get the next `#` numbers; the title is cleaned to how India Code prints it)
const have = new Set(rows.map((r) => norm(r["Exact title on India Code"]))); let nextNo = Math.max(...rows.map((r) => Number(r["#"]))) + 1;
const clean = (t) => t.replace(/\([^)]*\)/g, " ").replace(/,?\s*\d{1,3}\s+of\s+(?=[12]\d{3})/gi, ", ").replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,\s*$/, "").replace(/(\b[12]\d{3})\b.*$/, "$1").replace(/(\w)(,?\s*)(?=[12]\d{3}$)/, "$1, ").replace(/,\s*,/g, ",").trim();
for (const a of cov.acts.filter((x) => x.needsDownload).sort((x, y) => y.lostCases - x.lostCases || y.judgments - x.judgments).slice(0, 25)) {
  const title = clean(a.title), k = norm(title); if (have.has(k) || /constitution/i.test(title)) continue;
  const year = (/\b([12]\d{3})\b/.exec(title) ?? [])[1] ?? "check", slug = title.toLowerCase().replace(/^the /, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fills = a.status.startsWith("**absent") ? "absent from our library (no text)" : `${a.status.replace(/\*\*/g, "")}; most-cited sections we lack: ${a.lostSections.slice(0, 4).map((t) => t.number).join(", ") || "n/a"}`;
  const row = { Pri: "", "#": String(nextNo++), "Exact title on India Code": title, "Year (Act no.)": `${year} (check the number)`, "Date filter (enactment date)": `01-01-${year} to 31-12-${year}`, "Save as (`content/supplement/pdfs/`)": `\`${slug}.pdf\``, "What it fills": fills + (a.status.includes("repealed") || /Rep\./.test(a.title) ? "; repealed but still cited in judgments" : "") };
  rows.push(row); have.add(k);
}
for (const r of rows) {
  const key = norm(r["Exact title on India Code"].replace(/,\s*\d{4}\s*$/, (m) => m)), act = byTitle.get(key);
  const named = Object.entries(scan.variants).filter(([k]) => k === key || k.endsWith(` ${key}`)).reduce((n, [, l]) => Math.max(n, l.length), 0);   // judgments naming the Act (a lower bound: one name variant)
  r.cites = act ? act.judgments : named; r.lost = act ? act.lostCases : named; r.known = !!act;
  r.score = r.lost || 0;
}
const tier = (s) => (s >= 200 ? 1 : s >= 40 ? 2 : 3);
rows.sort((a, b) => b.score - a.score || b.cites - a.cites || Number(a["#"]) - Number(b["#"]));
const newHeader = hasCol ? header : [...header.slice(0, header.indexOf("What it fills")), "SC citations", "What it fills"];
const out = [`| ${newHeader.join(" | ")} |`, `|${newHeader.map((k) => (k === "Pri" || k === "#" ? "---:" : "---")).join("|")}|`];
for (const r of rows) {
  const cell = (k) => (k === "Pri" ? String(tier(r.score)) : k === "SC citations" ? (r.known ? `${r.cites} judgments cite the Act; ${r.lost} cite a section we lack` : r.cites ? `${r.cites} judgments name it` : "none found") : r[k]);
  out.push(`| ${newHeader.map(cell).join(" | ")} |`);
}
lines.splice(h, e - h, ...out);
const noteAt = lines.findIndex((l) => l.startsWith("**Rules.**"));
const note = "**Order (updated from real use).** The rows are ranked by how many Supreme Court judgments cite a section of that Act which we lack (or, for an Act not in our library, how many name it): see `docs/COVERAGE-PRIORITY.md` for the method. Pri 1 = 200 or more, Pri 2 = 40 or more, Pri 3 = the rest. The `#` numbers did not change. Judgments before 2024 cannot cite the new codes (BNS, BNSS, BSA), so those rows rank low on this measure though they matter for current law; download them anyway.\n";
if (noteAt >= 0 && !lines.some((l) => l.startsWith("**Order (updated from real use)"))) lines.splice(noteAt, 0, note);
fs.writeFileSync("docs/PDF-DOWNLOAD-LIST.md", lines.join("\n"));
console.log(rows.slice(0, 12).map((r) => `${r["#"]}\t${r.score}\t${r["Exact title on India Code"].slice(0, 60)}`).join("\n"));
