// Patterns that must NOT survive the display layer (src/lib/text/clean.mjs): if cleanPlain() leaves any of these in a text, the layer has a hole. Used by the unit test (synthetic junk) and by
// scripts/audit/clean-check.mjs (random real sections and judgments from the database).
export const RESIDUE = {
  "picture placeholder": /==>|<==/,
  "markdown bold": /\*\*/,
  "markdown heading at line start": /(^|\n)[ \t\u00a0]*#{1,6}[ \t\u00a0]/,
  "markdown quote at line start": /(^|\n)[ \t]*>[ \t]/,
  "HTML tag or entity": /<\/?(?:br|b|i|u|p|span|div|font|table|tr|td|th|li|ul|ol|a|sup|sub|em|strong|h[1-6])(?:\s[^<>]{0,40})?\/?>|&(amp|nbsp|lt|gt|quot);/i,
  "run of lost characters": /(?:�[ \t]*){2,}/,
  "literal backslash escape": /(?<![A-Za-z])\\[nrt](?![A-Za-z])/,
  "amendment number before a bracket": /(^|[^0-9A-Za-z])[0-9]{1,2}[ ]?\[(?!st\]|nd\]|rd\]|th\])/i,
  "bracketed number before a bracket": /\[[0-9]{1,2}\s?\]/,
  "spaced brackets ( a )": /\(\s+[A-Za-z0-9]{1,4}\s+\)/,
  "space before punctuation": /[A-Za-z0-9)\]] +[.,;:](?=[ \t]*$|[ \t]+(?!\d))/m,
  "emphasis underscore left on one side": /(?<=[A-Za-z0-9])_(?=[\s,.;:)\]]|$)|(?:^|[\s(\[])_(?=[A-Za-z0-9])/m,
  "run of three or more hyphens": /(?<![|:-])-{3,}(?![|:-])/,
  "runs of spaces or tabs": /[ \t]{2,}/,
  "quote mark printed as a double bar (\u2016)": /\u2016/,
  "control character": /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/,
};
export const residue = (text) => Object.entries(RESIDUE).filter(([, re]) => re.test(text)).map(([k]) => k);
