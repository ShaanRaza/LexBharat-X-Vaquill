// What each judgment field is, per court, and why a field is missing. Shown on every case page so nobody mistakes an absent field for an empty one.
// JUDGE_COURTS mirrors JUDGE_COURTS in scripts/judgments/export-judgments-hc.sh: keep the two in step.
export const SC_SLUG = "supreme-court-of-india";
export const JUDGE_COURTS = ["bombay-high-court", "gujarat-high-court", "orissa-high-court"];

export type FieldRow = { field: string; state: "shown" | "partly" | "absent"; note: string };

export function provenanceRows(court: string, has: { parties: boolean; judges: boolean; bench: boolean; pages: boolean; preview: boolean; citation: boolean; caseNumber: boolean; disposition: boolean; date: boolean }): FieldRow[] {
  const sc = court === SC_SLUG, judgeCourt = JUDGE_COURTS.includes(court);
  return [
    { field: "Parties", state: has.parties ? "partly" : "absent", note: has.parties ? "As extracted from the judgment text; can be truncated or contain extraction noise." : "Not shown: missing, or the extracted names failed a sanity check." },
    { field: "Citation", state: has.citation ? "shown" : "absent", note: sc ? (has.citation ? "Supreme Court Reports citation from the dataset." : "No citation recorded for this case.") : "Not in the dataset for High Courts. The case number is the identifier." },
    { field: "Case number", state: has.caseNumber ? "shown" : "absent", note: has.caseNumber ? "As recorded." : sc ? "The dataset has no case numbers for the Supreme Court." : "Not recorded for this case." },
    { field: "Decision date", state: has.date ? "shown" : "absent", note: has.date ? "From the dataset." : "Not recorded; the case is listed under the year in the record." },
    { field: "Disposition", state: has.disposition ? "shown" : "absent", note: has.disposition ? "As recorded in the dataset; High Court spellings vary and only common ones get a chip." : "Not recorded." },
    { field: "Judges", state: has.judges ? (sc ? "partly" : "shown") : "absent", note: sc ? "As listed in the source, usually the judge who authored the report; not the full bench." : judgeCourt ? (has.judges ? "Names pass a check; shown only when every name on the case does." : "Not shown for this case: an entry failed the name check.") : "Not shown for this court: the source's judge field is mostly sentence fragments." },
    { field: "Bench size", state: has.bench ? "shown" : "absent", note: sc ? "Not shown: the source understates Supreme Court benches (87% would read single judge)." : judgeCourt ? "Count of the checked judge names." : "Not shown for this court (judge field unreliable)." },
    { field: "Pages", state: has.pages ? "partly" : "absent", note: "Length of the extracted text, not an official page count." },
    { field: "Opening text", state: has.preview ? "partly" : "absent", note: sc ? (has.preview ? "First ~900 characters of the English document, as extracted (OCR errors possible)." : "No clean English opening text for this case.") : "Not available for High Courts: no verified rule for finding the operative text, and the first lines are court letterhead." },
    { field: "Judgment text", state: "absent", note: "Not available. Chunks of one case mix several languages and translations and have no reliable order." },
    { field: "Acts referred to", state: "absent", note: "Not in the dataset for judgments. Links to acts would have to be guessed from the text, so none are shown." },
  ];
}
