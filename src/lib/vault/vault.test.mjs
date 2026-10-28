import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { checkUpload, cleanName, kindFromName, readVaultLimits, sniffKind, storageName } from "./files.mjs";
import { chunkPages } from "./chunk.mjs";
import { extractText } from "./extract.mjs";
import { lexicalRank } from "./lexical.mjs";
import config from "../../config/vault-limits.json" with { type: "json" };

const L = readVaultLimits(config, {});
const enc = (s) => new TextEncoder().encode(s);

test("file kinds are read from the bytes, not the name", () => {
  assert.equal(kindFromName("A.PDF"), "pdf"); assert.equal(kindFromName("x.exe"), null);
  assert.equal(sniffKind(enc("%PDF-1.7 ...")), "pdf"); assert.equal(sniffKind(enc("hello world, plain text")), "txt");
  assert.equal(sniffKind(new Uint8Array([0x4d, 0x5a, 0, 1, 2])), null);   // an .exe renamed to .pdf
  assert.equal(sniffKind(new Uint8Array([0x50, 0x4b, 3, 4, ...enc("[Content_Types].xml word/document.xml")])), "docx");
  assert.equal(sniffKind(new Uint8Array([0x50, 0x4b, 3, 4, ...enc("other.bin")])), null);
});
test("upload limits: type, size, count, total", () => {
  assert.equal(checkUpload({ name: "a.pdf", size: 1000 }, [], L).ok, true);
  assert.match(checkUpload({ name: "a.zip", size: 1000 }, [], L).message, /Only PDF/);
  assert.match(checkUpload({ name: "a.pdf", size: 11 * 1048576 }, [], L).message, /most is 10 MB/);
  assert.match(checkUpload({ name: "a.pdf", size: 5 }, new Array(30).fill({ sizeBytes: 1 }), L).message, /30/);
  assert.match(checkUpload({ name: "a.pdf", size: 6 * 1048576 }, new Array(10).fill({ sizeBytes: 10 * 1048576 }), L).message, /100 MB/);
  assert.equal(readVaultLimits(config, { VAULT_MAX_DOCS: "3", VAULT_BUCKET: "x" }).maxDocs, 3);
  assert.equal(readVaultLimits(config, { VAULT_MAX_DOCS: "abc" }).maxDocs, 30);
});
test("names are cleaned for display and storage", () => {
  assert.equal(cleanName("../../etc/passwd"), ".. .. etc passwd"); assert.equal(storageName("My NDA (final).pdf"), "My_NDA_final_.pdf"); assert.ok(!storageName("../x").includes("/"));
});
test("chunks keep page and clause heading, and stay near the size", () => {
  const p1 = "1. Definitions\nIn this agreement the words have these meanings.\n2. Term\nThis agreement lasts five years.\n";
  const p2 = "3. Non-compete\nThe Recipient shall not compete anywhere in India for five years. ".repeat(40);
  const c = chunkPages([p1, p2], { chars: 500, overlap: 50 });
  assert.ok(c.length >= 4); assert.equal(c[0].page, 1); assert.match(c[0].label, /^1\. Definitions/);
  assert.ok(c.every((x) => x.body.length <= 560)); assert.ok(c.some((x) => x.page === 2 && /^3\. Non-compete/.test(x.label)));
  assert.deepEqual(c.map((x) => x.idx), c.map((_, i) => i));
});
test("keyword ranking finds the notice clause", () => {
  const ps = [{ body: "The Tenant shall pay rent on the fifth day.", label: "2. Rent" }, { body: "Either party may end this agreement by giving thirty days written notice.", label: "8. Termination" }];
  assert.equal(lexicalRank("what is the notice period", ps, 1)[0].label, "8. Termination"); assert.deepEqual(lexicalRank("zebra", ps), []);
});
test("text and pdf are extracted; a text-less pdf is reported as scanned", async () => {
  const t = await extractText("txt", enc("Hello\n\nWorld")); assert.equal(t.scanned, false); assert.match(t.text, /World/);
  const pdf = await PDFDocument.create(), f = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 2; i++) pdf.addPage([400, 400]).drawText(`Clause ${i}: the notice period is thirty days. Confidential information stays secret.`, { x: 20, y: 300, size: 10, font: f });
  const r = await extractText("pdf", await pdf.save()); assert.equal(r.pageCount, 2); assert.match(r.pages[1], /Clause 2/); assert.equal(r.scanned, false);
  const blank = await PDFDocument.create(); blank.addPage([400, 400]);
  const s = await extractText("pdf", await blank.save()); assert.equal(s.scanned, true); assert.deepEqual(s.scanPages, [1]);
  const img = await extractText("jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])); assert.deepEqual(img.scanPages, [1]); assert.equal(img.pageCount, 1);
  const bad = await extractText("pdf", enc("not a pdf")); assert.equal(bad.pages, null); assert.match(bad.reason, /can't be read/);
});

test("readPdfPages reads a PDF in slices that add up to the one-shot text", async () => {
  const { PDFDocument, StandardFonts } = await import("pdf-lib"), { readPdfPages, extractText } = await import("./extract.mjs");
  const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.TimesRoman);
  for (let i = 1; i <= 7; i++) d.addPage().drawText(`Page ${i} text of the agreement between the parties.`, { x: 40, y: 700, size: 11, font: f });
  const bytes = await d.save(), a = await readPdfPages(bytes, 1, { maxPages: 3 }), b = await readPdfPages(bytes, 4, { maxPages: 3 }), c = await readPdfPages(bytes, 7, { maxPages: 3 });
  assert.equal(a.total, 7); assert.equal(a.pages.length, 3); assert.equal(b.pages.length, 3); assert.equal(c.pages.length, 1);
  assert.deepEqual([...a.pages, ...b.pages, ...c.pages], (await extractText("pdf", bytes)).pages.map((p, i) => p || ""));
  assert.equal((await readPdfPages(new TextEncoder().encode("not a pdf"), 1)).total, 0);
});

import { chatLink, docFromSearch, newlyReady, previewLink, reviewLink } from "./links.mjs";
test("document actions: links, ?doc= parsing, and what counts as newly Ready", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  assert.equal(chatLink(id), `/workspace/chat?doc=${id}`); assert.equal(reviewLink(id), `/workspace/review?doc=${id}`); assert.equal(previewLink(id), `/workspace/vault/${id}`);
  assert.equal(docFromSearch(`?doc=${id}`), id); assert.equal(docFromSearch("?doc=../../x"), null); assert.equal(docFromSearch(""), null); assert.equal(docFromSearch("?other=1"), null);
  const d = (i, status) => ({ id: i, status });
  assert.deepEqual(newlyReady([d("a", "processing"), d("b", "ready"), d("c", "waiting")], [d("a", "ready"), d("b", "ready"), d("c", "ready"), d("n", "ready")]).map((x) => x.id), ["a", "c"]);
  assert.deepEqual(newlyReady([d("a", "processing")], [d("a", "unreadable")]), []);
});
