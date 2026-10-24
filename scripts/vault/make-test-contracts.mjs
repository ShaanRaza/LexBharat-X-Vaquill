// Makes three FICTIONAL test contracts (each as PDF and DOCX), a scanned-style image-only PDF and a few bad files, in ../lexbharat-data/w6-test-files. No real data. usage: node scripts/vault/make-test-contracts.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildDocx, buildPdf } from "../../src/lib/drafting/export.mjs";

const OUT = "../lexbharat-data/w6-test-files"; fs.mkdirSync(OUT, { recursive: true });
const T = (text, o = {}) => ({ text, ...o });
const H = (t) => ({ type: "heading", level: 1, runs: [T(t, { bold: true })] }), S = (t) => ({ type: "heading", level: 2, runs: [T(t, { bold: true })] }), P = (t) => ({ type: "p", runs: [T(t)] });
const clauses = (title, intro, list) => [H(title), P(intro), ...list.flatMap(([h, ...ps]) => [S(h), ...ps.map(P)])];

const nda = clauses("MUTUAL NON-DISCLOSURE AGREEMENT", "This Non-Disclosure Agreement is made on 1 March 2026 at New Delhi between Alpha Robotics Private Limited, a company incorporated in India (the \"Disclosing Party\") and Beta Components Private Limited, a company incorporated in India (the \"Receiving Party\"). All names are fictional.", [
  ["1. Definitions", "1.1 \"Confidential Information\" means all technical, commercial and financial information disclosed by the Disclosing Party to the Receiving Party in any form, whether or not marked confidential.", "1.2 Confidential Information does not include information that is public, or independently developed by the Receiving Party."],
  ["2. Confidentiality obligations", "2.1 The Receiving Party shall keep the Confidential Information strictly confidential and use it only to evaluate a possible supply arrangement between the parties.", "2.2 The Receiving Party shall not disclose Confidential Information to any third party without the prior written consent of the Disclosing Party."],
  ["3. Term", "3.1 This Agreement remains in force for two (2) years from the date above. The confidentiality obligations survive for three (3) years after termination."],
  ["4. Non-compete", "4.1 For a period of five (5) years from the date of this Agreement, the Receiving Party shall not, directly or indirectly, carry on, be engaged in or be interested in any business that competes with the business of the Disclosing Party anywhere in the territory of India.", "4.2 The Receiving Party acknowledges that this restriction is reasonable and necessary to protect the Disclosing Party's legitimate interests."],
  ["5. Penalty for breach", "5.1 If the Receiving Party breaches any provision of this Agreement, it shall pay the Disclosing Party a penalty of Rs. 50,00,000 (Rupees Fifty Lakh only) as agreed damages, without the Disclosing Party having to prove any actual loss.", "5.2 This amount is in addition to any other remedy available to the Disclosing Party."],
  ["6. Return of materials", "6.1 On written request the Receiving Party shall return or destroy all documents containing Confidential Information within seven (7) days."],
  ["7. Notices", "7.1 A party wishing to end this Agreement early must give the other party thirty (30) days' written notice."],
  ["8. Governing law and disputes", "8.1 This Agreement is governed by the laws of India. The courts at New Delhi have exclusive jurisdiction."],
  ["9. General", "9.1 This Agreement is the entire agreement between the parties on its subject. Any change must be in writing and signed by both parties."]]);

const svc = clauses("SERVICE AGREEMENT", "This Service Agreement is made on 15 April 2026 between Northwind Software Services Private Limited, Bengaluru (the \"Service Provider\") and Cedar Retail Limited, Mumbai (the \"Client\"). All names are fictional.", [
  ["1. Services", "1.1 The Service Provider shall develop and maintain the Client's online ordering platform as described in Schedule A."],
  ["2. Fees and payment", "2.1 The Client shall pay a monthly fee of Rs. 4,50,000 plus applicable GST. Invoices are payable within sixty (60) days of receipt.", "2.2 Late payments carry interest at 24% a year."],
  ["3. Term and termination", "3.1 This Agreement runs for three (3) years. The Client may terminate for convenience on thirty (30) days' notice; the Service Provider may terminate only on one hundred and eighty (180) days' notice."],
  ["4. Intellectual property", "4.1 All work product, including any pre-existing tools of the Service Provider incorporated into it, belongs to the Client from the moment of creation."],
  ["5. Liability and indemnity", "5.1 The Service Provider's liability to the Client under or in connection with this Agreement is unlimited and extends to all direct, indirect and consequential losses of any kind.", "5.2 The Service Provider shall indemnify the Client against every claim, loss or expense arising from the Services, however caused."],
  ["6. Confidentiality", "6.1 Each party shall keep the other's confidential information secret during the term and for two (2) years afterwards."],
  ["7. Governing law and jurisdiction", "7.1 This Agreement and any dispute arising from it are governed by the laws of England and Wales.", "7.2 The courts of London, England have exclusive jurisdiction."],
  ["8. General", "8.1 Neither party may assign this Agreement without the other's written consent."]]);

const rent = clauses("LEAVE AND LICENCE AGREEMENT", "This Leave and Licence Agreement is made on 1 June 2026 at Mumbai, Maharashtra between Mrs. Asha Kulkarni, residing at Dadar, Mumbai (the \"Licensor\") and Mr. Rohan Mehta, residing in Pune (the \"Licensee\"). All names are fictional.", [
  ["1. Premises", "1.1 The Licensor grants the Licensee leave and licence to use Flat No. 12, Sunrise Apartments, Dadar, Mumbai (the \"Premises\") for residential use only."],
  ["2. Period", "2.1 The licence is for eleven (11) months from 1 June 2026. It may be renewed by a written agreement between the parties."],
  ["3. Licence fee and deposit", "3.1 The Licensee shall pay a monthly licence fee of Rs. 45,000 on or before the fifth day of each month.", "3.2 The Licensee has paid an interest-free security deposit of Rs. 3,00,000, refundable at the end of the licence after deducting any dues."],
  ["4. Lock-in and termination", "4.1 Neither party may terminate the licence in the first six (6) months. After that either party may terminate on one (1) month's written notice."],
  ["5. Use and maintenance", "5.1 The Licensee shall use the Premises with care, shall not sublet them, and shall pay electricity, water and society maintenance charges.", "5.2 The Licensee shall not make structural changes."],
  ["6. Possession and return", "6.1 At the end of the licence the Licensee shall hand back vacant possession of the Premises in the condition received, allowing for normal wear."],
  ["7. Disputes", "7.1 The parties shall try to settle any dispute by discussion. Failing that, the courts at Mumbai have jurisdiction."]]);

async function png(w, h) {   // a plain grayscale PNG with dark blocks, no text
  const raw = Buffer.alloc((w + 1) * h, 255);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; for (let x = 0; x < w; x++) { const block = (Math.floor(y / 14) % 2 === 0) && x > 60 && x < w - 60 && ((x * 7 + y * 3) % 11 < 7); if (block) raw[y * (w + 1) + 1 + x] = 60; } }
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const files = { "nda-test-contract": nda, "service-agreement-test-contract": svc, "maharashtra-leave-licence-test-contract": rent };
for (const [name, blocks] of Object.entries(files)) {
  fs.writeFileSync(`${OUT}/${name}.pdf`, await buildPdf(blocks, { title: name }));
  fs.writeFileSync(`${OUT}/${name}.docx`, await buildDocx(blocks, { title: name }));
}
const pdf = await PDFDocument.create(), img = await pdf.embedPng(await png(600, 800)); for (let i = 0; i < 2; i++) pdf.addPage([600, 800]).drawImage(img, { x: 0, y: 0, width: 600, height: 800 });
fs.writeFileSync(`${OUT}/scanned-image-only.pdf`, await pdf.save());
fs.writeFileSync(`${OUT}/fake.pdf`, "MZ this is not really a pdf, it is renamed text with a PDF extension\n");
fs.writeFileSync(`${OUT}/notes.txt`, "Meeting notes (fictional): the notice period for the supplier is 45 days.\n");
fs.writeFileSync(`${OUT}/too-big.txt`, Buffer.alloc(10.5 * 1024 * 1024, "a"));
console.log(fs.readdirSync(OUT).join("\n"));
