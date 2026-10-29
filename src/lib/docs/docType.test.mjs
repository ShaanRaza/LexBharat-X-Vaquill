import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle, docTypeOf, sourceInfo, unitWord, unitsWord } from "./docType.mjs";

test("every kind of document names its units correctly", () => {
  assert.equal(unitWord("138", { title: "The Negotiable Instruments Act, 1881", category: "central" }), "Section 138");
  assert.equal(unitWord("A226", { title: "The Constitution of India", category: "central" }), "Article 226");
  assert.equal(unitWord("21", { title: "The Constitution of India" }), "Article 21");
  assert.equal(unitWord("O39R1", { title: "The Code of Civil Procedure, 1908" }), "Order 39 Rule 1");
  assert.equal(unitWord("3", { title: "The Companies (Accounts) Rules, 2014", category: "central" }), "Rule 3");
  assert.equal(unitWord("5", { title: "Securities and Exchange Board of India (Listing Obligations) Regulations, 2015", department: "sebi", category: "regulatory" }), "Regulation 5");
  assert.equal(unitWord("4", { title: "Master Direction on KYC", department: "rbi", category: "regulatory" }), "Paragraph 4");
  assert.equal(unitWord("2", { title: "Advisory022026", department: "cbic", actId: "REG_x" }), "Paragraph 2");
  assert.equal(unitWord("7", { title: "THE FINANCE ACT, 2020", department: "mca", category: "regulatory" }), "Section 7");   // an Act filed under a regulator is still an Act
  assert.equal(unitsWord({ title: "Circular on margins", department: "sebi" }), "paragraphs");
  assert.equal(docTypeOf({ title: "The Bharatiya Nyaya Sanhita, 2023" }).unit, "Section");
});
test("the source link and what to call it follow the document, never a wrong India Code link for a regulator", () => {
  assert.deepEqual(sourceInfo({ title: "The Contract Act, 1872" }, "https://www.indiacode.nic.in/handle/123/456"), { url: "https://www.indiacode.nic.in/handle/123/456", label: "India Code" });
  assert.deepEqual(sourceInfo({ title: "The Contract Act, 1872" }, null), { url: "https://www.indiacode.nic.in/", label: "India Code" });
  assert.deepEqual(sourceInfo({ title: "Master Direction", department: "rbi", category: "regulatory" }, "https://rbi.org.in/Scripts/x.aspx?id=1"), { url: "https://rbi.org.in/Scripts/x.aspx?id=1", label: "RBI website" });
  assert.equal(sourceInfo({ title: "Advisory", department: "cbic", category: "regulatory" }, null), null);   // no link at all beats a link to the wrong place
});
test("titles are tidied: capitals, acronyms, glued digits, encoding, fallbacks", () => {
  assert.equal(displayTitle("Advisory022026", { department: "cbic" }), "Advisory 02/2026");
  assert.equal(displayTitle("Cgst Rules 01July2017"), "CGST Rules 01 July 2017");
  assert.equal(displayTitle("List%20Of%20Services%20Under%20Reverse%20Charge"), "List Of Services Under Reverse Charge");
  assert.equal(displayTitle("The delhi rent control act, 1958"), "The Delhi Rent Control Act, 1958");
  assert.equal(displayTitle("THE  FINANCE  ACT, 2020"), "The Finance Act, 2020");
  assert.equal(displayTitle("The CODE OF CRIMINAL PROCEDURE, 1973"), "The Code of Criminal Procedure, 1973");
  assert.equal(displayTitle("The Criminal-Procedure-Code-CrPC-1973"), "The Criminal Procedure Code CrPC 1973");
  assert.equal(displayTitle("rbi circular on kyc norms"), "RBI Circular on KYC Norms");
  assert.equal(displayTitle("regarding stop discharge of untreated effluent into river by the unit"), "Regarding Stop Discharge of Untreated Effluent into River by the Unit");
  assert.equal(displayTitle("The Negotiable Instruments Act, 1881"), "The Negotiable Instruments Act, 1881");   // already right: untouched
  assert.equal(displayTitle("", { department: "sebi", year: 2019 }), "SEBI instrument (2019)");
  assert.equal(displayTitle("2019", { department: "rbi", year: 2019 }), "RBI instrument (2019)");
  assert.equal(displayTitle("MoEFCC notification"), "MoEFCC notification");
  assert.equal(displayTitle("नक्शा"), "नक्शा");
});
