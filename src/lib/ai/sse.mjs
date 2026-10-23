// Server-sent events from a fetch response body. PURE helper: yields { event, data } for each event, however the bytes are split across chunks.
export async function* sseEvents(body) {
  const reader = body.getReader(), dec = new TextDecoder();
  let buf = "";
  const parse = (block) => {
    let event = "message"; const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    return data.length ? { event, data: data.join("\n") } : null;
  };
  for (;;) {
    const { value, done } = await reader.read();
    buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
    let m;
    while ((m = /\r?\n\r?\n/.exec(buf))) { const ev = parse(buf.slice(0, m.index)); buf = buf.slice(m.index + m[0].length); if (ev) yield ev; }
    if (done) { const ev = parse(buf); if (ev) yield ev; return; }
  }
}
