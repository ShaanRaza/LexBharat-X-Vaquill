"use client";
import { useState } from "react";
import { mcpClients, mcpSetup } from "@/data/mcpTools";

export default function McpSetup() {
  const [c, setC] = useState(mcpClients[0]);
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {mcpClients.map((x) => (
          <button key={x} role="tab" aria-selected={c === x} onClick={() => setC(x)} className={`rounded-full border px-4 py-1.5 text-fs-ui ${c === x ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}>{x}</button>
        ))}
      </div>
      <pre tabIndex={0} className="mt-4 overflow-x-auto rounded-panel border border-[var(--code-border)] bg-[var(--code-bg)] p-4 font-mono text-fs-12.5 leading-6 whitespace-pre-wrap">{mcpSetup[c]}</pre>
    </div>
  );
}
