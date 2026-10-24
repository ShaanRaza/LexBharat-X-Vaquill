// The Articles of the Limitation Act Schedule and of Schedule I of the Indian Stamp Act are stored one per unit ("A137") with labelled lines; this turns them into table rows. PURE logic.
const KINDS = {
  limitation: { labels: ["Description of suit", "Period of limitation", "Time from which period begins to run"], title: "Schedule: periods of limitation" },
  stamp: { labels: ["Description of instrument", "Proper stamp-duty"], title: "Schedule I: stamp duty (Central rates as printed)" },
};

/** "limitation" | "stamp" | null, from the first line of a unit's text. */
export function tableKindOf(body) {
  const first = String(body ?? "").split("\n", 1)[0];
  return first.startsWith("Description of suit:") ? "limitation" : first.startsWith("Description of instrument:") ? "stamp" : null;
}

/** { article: "137", cells: [description, period, from], group: "THIRD DIVISION—APPLICATIONS · PART II—OTHER APPLICATION" } for one unit, or null when the text is not a table row. */
export function articleRow(number, body) {
  const kind = tableKindOf(body), art = /^A(\d{1,3}[A-Z]{0,2})$/.exec(String(number).toUpperCase());
  if (!kind || !art) return null;
  const labels = KINDS[kind].labels, cells = labels.map(() => ""), extra = [];
  for (const line of String(body).split("\n")) {
    const i = labels.findIndex((l) => line.startsWith(`${l}:`));
    if (i >= 0) cells[i] = line.slice(labels[i].length + 1).trim(); else if (line.trim()) extra.push(line.trim());
  }
  return { kind, article: art[1], cells, group: extra.join(" · ") };
}

export const tableInfo = (kind) => ({ ...KINDS[kind], columns: ["Article", ...KINDS[kind].labels.map((l) => l.replace(/^Description of (suit|instrument)$/, "Description of $1"))] });

/** Rows sorted by article number (137 before 137A), each with `startsGroup` set where the division/part label changes. */
export function buildScheduleTable(units, gaps) {
  const key = (a) => { const m = /^(\d+)([A-Z]*)$/.exec(a); return Number(m[1]) * 100 + (m[2] ? m[2].charCodeAt(0) - 64 : 0); };
  const rows = units.map((u) => articleRow(u.number, u.body)).filter(Boolean);
  const kind = rows[0]?.kind ?? null;
  // Articles the PDF does not print get a row saying so, in their place
  if (kind && gaps?.numbers?.length) for (const n of gaps.numbers) rows.push({ kind, article: String(n), cells: [gaps.note, ...Array.from({ length: KINDS[kind].labels.length - 1 }, () => "")], group: "", notPrinted: true });
  rows.sort((a, b) => key(a.article) - key(b.article));
  let last = null;
  return { kind, ...(kind ? tableInfo(kind) : {}), rows: rows.map((r) => { const startsGroup = r.group !== last; last = r.group; return { ...r, startsGroup }; }) };
}
