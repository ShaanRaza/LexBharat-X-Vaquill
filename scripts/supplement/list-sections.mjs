// Lists every main section printed in an Act PDF, in order: [{ number, line }]. A start line is "N. Heading.—text" or a repealed "N. [Heading.] Rep. ...". State amendments (quoted insertions
// such as “10A. ...” and anything after a STATE AMENDMENTS heading that does not move on to a higher section number) are skipped, and the list stops at the first Schedule.
import { pdfLines } from "./pdf-text.mjs";
const ANY = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*(.{1,200}?)\.?[”"’]?\s*[—–]/;
const REP = /^(?:\[?(\d{1,3})([A-Z]{0,3})\.\s*\[.+?\]|\[(\d{1,3})([A-Z]{0,3})\.\s*[^\]]+\])\s*(?:Rep\.|Omitted|Ins\.|Subs\.)/;   // "N. [Heading.] Rep. by ..." or "[N. Heading.] Omitted by ..."
const HEAD_ONLY = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*(.{3,200}\.)$/;   // a complete heading on its own line; the text follows on the next line with its own side-note
const BRACKETED = /^\[?(\d{1,3})([A-Z]{0,3})\.\s*\[/;
const SCHEDULE = /^\[?(THE\s+)?((FIRST|SECOND|THIRD)\s+)?SCHEDULE\s*[IVX\d]*\s*(\(.{0,40}\))?\s*$/;   // capitals, on a line of its own

/** What kind of section start (if any) the line at index i is: { kind, n, suf }. strict = "N. Heading.—text"; wrapped = the heading's ".—" is on the next line; headOnly = "N. Heading." alone and the text
 *  follows with its own side-note; repealed = a repealed/omitted/superseded section printed "N. [Heading ...] Rep. by ...". */
export function startAt(lines, i) {
  const t = lines[i].text, next = lines[i + 1]?.text ?? "";
  let m = ANY.exec(t);
  if (m) return { kind: "strict", n: Number(m[1]), suf: m[2] ?? "" };
  if (/^[^\d(\[].{0,120}?\.\s*[—–]/.test(next)) {
    m = /[.\]]$/.test(t) ? HEAD_ONLY.exec(t) : ANY.exec(`${t} ${next}`);
    if (m) return { kind: /[.\]]$/.test(t) ? "headOnly" : "wrapped", n: Number(m[1]), suf: m[2] ?? "" };
  }
  // a long heading wrapped over three or four printed lines ("4. Laws made under articles 2 and 3 to provide for the / amendment of ... / supplemental ... matters.—(1) ..."): the ".—" is on the last of them
  const lead = /^\[?(\d{1,3})([A-Z]{0,3})\.\s+\S/.exec(t);
  if (lead && !/[—–]/.test(t)) for (let k = 3; k <= 4; k++) {
    const parts = lines.slice(i, i + k).map((x) => x.text);
    if (parts.length < k || parts.slice(1).some((x) => /^[\d(\[]/.test(x)) || /[—–]/.test(parts.slice(0, -1).join(" "))) break;
    const mm = ANY.exec(parts.join(" ")); if (mm) return { kind: "wrapped", n: Number(mm[1]), suf: mm[2] ?? "", span: k };
  }
  const rp = REP.exec(t); if (rp) return { kind: "repealed", n: Number(rp[1] ?? rp[3]), suf: rp[2] ?? rp[4] ?? "" };
  m = BRACKETED.exec(t); if (m) return { kind: "repealed", n: Number(m[1]), suf: m[2] ?? "" };
  return null;
}

export function listSections(lines) {
  // the body starts at the first line where section 1 starts with "1. Heading.—" (the table of contents before it has no dashes and is ignored)
  const first = lines.findIndex((l) => { const m = ANY.exec(l.text); return m && Number(m[1]) === 1 && m[2] === ""; });
  if (first < 0) return [];
  const out = []; let last = 0, lastSuf = "", inState = false;
  for (let i = first; i < lines.length; i++) {
    const t = lines[i].text;
    if (SCHEDULE.test(t) && out.length) break;
    if (/^STATE AMENDMENTS?\b/i.test(t)) { inState = true; continue; }
    const st = startAt(lines, i); if (!st) continue;
    const higher = st.n > last || (st.n === last && st.suf > lastSuf);
    if (!higher || (inState && st.n === last) || st.n > last + 40) continue;   // inside a state-amendment block only a NEW section number counts
    out.push({ number: `${st.n}${st.suf}`, line: i, page: lines[i].page, kind: st.kind, text: t.slice(0, 70) }); last = st.n; lastSuf = st.suf; inState = false;
  }
  return out;
}
if (process.argv[1]?.endsWith("list-sections.mjs") && process.argv[2]) {
  const l = await pdfLines(process.argv[2]), s = listSections(l);
  console.log(s.length, "sections;", s.slice(0, 5).map((x) => x.number).join(","), "...", s.slice(-5).map((x) => x.number).join(","));
  const nums = s.map((x) => parseInt(x.number, 10)), gaps = []; for (let k = 1; k < nums.length; k++) if (nums[k] - nums[k - 1] > 1) gaps.push(`${s[k - 1].number}->${s[k].number}`);
  console.log("gaps:", gaps.join(" ") || "none");
}
