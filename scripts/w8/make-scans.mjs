#!/usr/bin/env node
// Makes the fictional scanned test files for W8 into ../lexbharat-data/w8-test-files (nothing real): a clean scan, a skewed low-quality scan, a mixed PDF (text pages + image pages), a Hindi scan,
// a JPG, and a 24-page scan for the 20-page limit. Needs pdftoppm (poppler) and Google Chrome (only for the Hindi page). usage: node scripts/w8/make-scans.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PDFDocument, degrees } from "pdf-lib";
const SRC = "../lexbharat-data/w6-test-files", OUT = "../lexbharat-data/w8-test-files", TMP = path.join(OUT, "tmp");
fs.mkdirSync(TMP, { recursive: true });
const raster = (pdf, base, args) => { execFileSync("pdftoppm", [...args, pdf, path.join(TMP, base)]); return fs.readdirSync(TMP).filter((f) => f.startsWith(base + "-")).sort().map((f) => path.join(TMP, f)); };
async function imagesToPdf(files, { skew = 0 } = {}) {
  const pdf = await PDFDocument.create();
  for (const f of files) {
    const bytes = new Uint8Array(fs.readFileSync(f)), img = /\.png$/i.test(f) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const w = 595, h = Math.round((w * img.height) / img.width), page = pdf.addPage([w, h]);
    if (skew) page.drawImage(img, { x: 25, y: -8, width: w - 30, height: h - 20, rotate: degrees(skew) }); else page.drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  return pdf.save();
}
const nda = `${SRC}/nda-test-contract.pdf`;
// 1. clean scan: the NDA rendered to pictures, no text layer
fs.writeFileSync(`${OUT}/scan-clean-nda.pdf`, await imagesToPdf(raster(nda, "clean", ["-r", "130", "-png"])));
// 2. skewed, low-quality: small blurry JPEGs, rotated 2.5 degrees
fs.writeFileSync(`${OUT}/scan-skewed-lowquality-nda.pdf`, await imagesToPdf(raster(nda, "low", ["-r", "62", "-jpeg", "-jpegopt", "quality=18"]), { skew: 2.5 }));
// 3. mixed: page 1 stays text, page 2 is a picture; then the service agreement's page 1 as a picture
const svc = `${SRC}/service-agreement-test-contract.pdf`, mixed = await PDFDocument.create(), txt = await PDFDocument.load(fs.readFileSync(nda)), svcImgs = raster(svc, "svc", ["-r", "130", "-png", "-f", "2", "-l", "2"]);
const [p1] = await mixed.copyPages(txt, [0]); mixed.addPage(p1);
const im = await mixed.embedPng(fs.readFileSync(svcImgs[0])), pg = mixed.addPage([595, Math.round((595 * im.height) / im.width)]); pg.drawImage(im, { x: 0, y: 0, width: 595, height: pg.getHeight() });
const [p2] = await mixed.copyPages(txt, [1]); mixed.addPage(p2);
fs.writeFileSync(`${OUT}/mixed-text-and-scan.pdf`, await mixed.save());
// 4. Hindi: a fictional rent note in Devanagari, printed to PDF by Chrome, then turned into a picture-only PDF
const html = `<!doctype html><meta charset="utf-8"><body style="font-family:'Kohinoor Devanagari','Devanagari Sangam MN',sans-serif;font-size:17px;line-height:1.7;margin:40px"><h2>किराया समझौता</h2>
<p>यह समझौता दिनांक 5 मई 2026 को दिल्ली में श्री राम प्रसाद (मकान मालिक) और श्रीमती सीता देवी (किराएदार) के बीच किया गया है। सभी नाम काल्पनिक हैं।</p>
<p>1. किराया: किराएदार प्रति माह पाँच हज़ार रुपये (₹5,000) मकान मालिक को हर महीने की सात तारीख तक देगा।</p>
<p>2. अवधि: यह समझौता ग्यारह महीने के लिए है। किसी भी पक्ष को एक महीने का लिखित नोटिस देना होगा।</p>
<p>3. जमानत राशि: किराएदार दस हज़ार रुपये (₹10,000) सुरक्षा जमा के रूप में देगा, जो मकान खाली करने पर वापस की जाएगी।</p></body>`;
fs.writeFileSync(path.join(TMP, "hindi.html"), html);
execFileSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${path.join(TMP, "hindi-text.pdf")}`, `file://${path.resolve(TMP, "hindi.html")}`], { stdio: "ignore" });
fs.writeFileSync(`${OUT}/scan-hindi.pdf`, await imagesToPdf(raster(path.join(TMP, "hindi-text.pdf"), "hi", ["-r", "130", "-png", "-l", "1"])));
// 5. a plain JPG of the clean scan's first page
const jp = raster(nda, "jpg", ["-r", "110", "-jpeg", "-jpegopt", "quality=70", "-f", "1", "-l", "1"]); fs.copyFileSync(jp[0], `${OUT}/photo-page.jpg`);
// 6. 24 scanned pages (to test the 20-page limit): the clean pages repeated
const many = raster(nda, "many", ["-r", "90", "-png"]); fs.writeFileSync(`${OUT}/scan-24-pages.pdf`, await imagesToPdf(Array.from({ length: 24 }, (_, i) => many[i % many.length])));
// the text of the original NDA, for checking the readings
fs.writeFileSync(`${OUT}/nda-original.txt`, execFileSync("pdftotext", [nda, "-"]).toString());
fs.writeFileSync(`${OUT}/scan-hindi-original.txt`, execFileSync("pdftotext", [path.join(TMP, "hindi-text.pdf"), "-"]).toString());
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fs.readdirSync(OUT).map((f) => `${f} ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`).join("\n"));
