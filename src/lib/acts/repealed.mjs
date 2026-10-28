// "Repealed — see BNS" notes. PURE logic over src/config/repealed-acts.json (passed in, so tests can use their own). Points at the new Act as a whole; never at a section.
/** { text, short, newName, href } for a repealed Act, or null. */
export function repealedNote(actId, table) {
  const r = table?.[actId];
  if (!r || typeof r !== "object") return null;
  return { text: `Repealed — see ${r.short}`, short: r.short, newName: r.newName, name: r.name, href: `/law/${r.newActId}` };
}
