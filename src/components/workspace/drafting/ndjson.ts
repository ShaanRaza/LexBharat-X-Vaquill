// Reads a streamed response of newline-delimited JSON events (what /api/drafting/generate sends).
export async function* readEvents<T = Record<string, unknown>>(res: Response): AsyncGenerator<T> {
  const reader = res.body!.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) yield JSON.parse(line) as T; }
    if (done) return;
  }
}
