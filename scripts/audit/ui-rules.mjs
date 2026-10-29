// Static checks for "looks clickable but is not" and "is clickable but does not look it". Parses every .tsx under src with the TypeScript compiler (no regex guessing about attributes) and reports violations.
// Used by scripts/audit/ui-scan.mjs (a list for people) and src/ui-audit.test.mjs (a test that must find nothing).
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const NON_INTERACTIVE = new Set(["div", "span", "li", "p", "td", "tr", "article", "section", "header", "footer", "img", "ul", "ol", "h1", "h2", "h3", "h4", "svg", "aside", "nav", "dl", "dt", "dd", "table"]);
const LINKS = new Set(["a", "Link"]);
const AFFORDANCE = /underline|text-primary|text-quality-info|hover:|\bbg-|ring-|rounded-chip|rounded-button|\bborder|buttonClass|toggleClass|font-medium|text-foreground|text-secondary|\bflex\b|\bblock\b|\bgrid\b|group/;   // a link that fills a card or carries a colour or shape reads as clickable
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : []));

function attrText(node, name) {
  const a = node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.text === name);
  if (!a) return { has: false };
  const init = a.initializer;
  if (!init) return { has: true, value: true };
  if (ts.isStringLiteral(init)) return { has: true, value: init.text };
  if (ts.isJsxExpression(init) && init.expression) { const e = init.expression; return { has: true, value: ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null, dynamic: !(ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)), source: e.getText() }; }
  return { has: true, value: null, dynamic: true };
}

// Fields that hold text taken from the data (a section heading, a snippet, a quote, a preview, a body): shown to a reader only through the shared display layer (src/lib/text/clean.mjs) or a component that uses it.
const SOURCE_TEXT = /\.(heading|snippet|preview|quote|body|chapter)\b/;
const CLEANED = /cleanLabel|cleanPlain|cleanHeading|cleanParts|previewText|previewOf|DisplayText|Highlight|toBlocks|CitedText|StatuteText|displayTitle/;

export function scanFile(file) {
  const text = fs.readFileSync(file, "utf8"), sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), out = [];
  const add = (node, rule, msg) => { const { line } = sf.getLineAndCharacterOfPosition(node.getStart()); out.push({ file, line: line + 1, rule, msg }); };
  (function walk(n) {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(), cls = attrText(n, "className"), clsSrc = cls.dynamic ? cls.source : cls.value ?? "";
      const has = (k) => attrText(n, k).has, clickable = has("onClick") || has("href");
      const role = attrText(n, "role").value, composite = /^(option|menuitem|tab|treeitem|presentation|none)$/.test(role ?? "") || has("aria-selected");   // a listbox option or menu item is operated from the keyboard by its container
      const stretched = /after:inset-0/.test(ts.isJsxOpeningElement(n) ? n.parent.getText() : "");   // a card whose title link stretches over the whole card
      if (NON_INTERACTIVE.has(tag) && has("onClick") && !composite && !(has("role") && has("tabIndex") && has("onKeyDown"))) add(n, "R1", `<${tag}> has onClick but is not a button or link (no keyboard or role)`);
      if (NON_INTERACTIVE.has(tag) && !clickable && /cursor-pointer/.test(clsSrc ?? "")) add(n, "R2", `<${tag}> shows a pointer cursor but does nothing`);
      if (tag === "button" && !has("type")) add(n, "R3", "<button> without a type (it would submit a surrounding form)");
      if (LINKS.has(tag) && !has("href")) add(n, "R4", `<${tag}> without href`);
      if (NON_INTERACTIVE.has(tag) && !clickable && /(^|[\s"'`])hover:(bg|text|underline|ring|shadow|border)/.test(clsSrc ?? "") && !/group-hover/.test(clsSrc ?? "") && !stretched) add(n, "R5", `<${tag}> reacts to hover but is not clickable`);
      if (LINKS.has(tag) && has("href") && !AFFORDANCE.test(clsSrc ?? "") && !cls.dynamic) add(n, "R6", `<${tag}> has no colour, underline or shape: it will not look clickable`);
      if (tag === "button" && has("onClick") && !cls.dynamic && !AFFORDANCE.test(clsSrc ?? "")) add(n, "R7", "<button> has no colour, border or fill: it will not look clickable");
    }
    // R9: a data-text field printed straight into the page (a JSX child expression)
    if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent)) {
      const t = n.expression.getText();
      if (SOURCE_TEXT.test(t) && !CLEANED.test(t) && !/\.map\(|\.filter\(/.test(t)) add(n, "R9", `source text printed without the display layer: {${t.slice(0, 70)}}`);
    }
    ts.forEachChild(n, walk);
  })(sf);
  return out;
}
export const scanAll = (root = "src") => files(root).flatMap(scanFile).filter((v) => !/\.test\./.test(v.file));
