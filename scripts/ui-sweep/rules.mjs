// Wording and text patterns shared by the unit audit (src/ui-audit.test.mjs, reads the source) and the browser sweep (scripts/ui-sweep/sweep.mjs, reads the rendered pages).
import { RESIDUE } from "../../src/lib/text/residue.mjs";

/** Wording from the old design that must not appear on any screen. */
export const OLD_WORDING = [/Browse Laws/, /\bWorkspace\b/, /Legal Data (&|and|&amp;) API/, /\bDeveloper console\b/, /\bPlayground\b/, /\b(?:your|a|the|this|new|loading|open|delete) chats?\b/i, /\bdev(?:elopment)? server\b/i, /recreated placeholder|placeholder date|placeholder text/i];

/** Things that must never be printed on a finished page: source junk (the display layer's residue list) and programming leftovers. */
export const RAW_ON_PAGE = {
  ...Object.fromEntries(Object.entries(RESIDUE).filter(([k]) => !/runs of spaces|space before punctuation/.test(k))),   // rendered innerText collapses spaces; layout spacing is not source junk
  "undefined / null / NaN as text": /(?:^|[\s>(])(?:undefined|NaN|null)(?:$|[\s<.,;:)])/,
  "[object Object]": /\[object Object\]/,
  "unfilled template {{ }} or ${ }": /\{\{|\$\{/,
  "percent-encoded text %20": /%20/,
  "underscore_joined_words": /\b[A-Za-z]{3,}_[A-Za-z]{3,}_[A-Za-z]{2,}\b/,
};
