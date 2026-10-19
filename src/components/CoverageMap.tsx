"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { jurisdictions } from "@/data/jurisdictions";
import { US_MAP, US_MAP_VIEWBOX } from "@/data/usMapPaths";
import { stateBreakdown } from "@/data/stateBreakdown";
import Reveal from "./Reveal";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

// Coverage layers and their map colours (white label on the two darker steps meets 4.5:1).
const LAYER_COLOR = { 0: "#cba099", 1: "#a8706a", 2: "#6e3730" } as const;
const HOVER_FILL = "#8a4a40";
const layers = ["Statutes", "Statutes + regulations", "Statutes + regulations + constitution"] as const;
const PR = { name: "Puerto Rico", sections: 26672 };
const MIN_ZOOM = 1, MAX_ZOOM = 8;
const stats = [
  ["60,494", "US Code sections"], ["222,311", "CFR sections"], ["196,816", "Federal Register rules"], ["2M+", "State statute sections"],
  ["425,427", "Statutes at Large"], ["96,966", "Agency guidance documents"], ["100,920", "Agency adjudications"], ["20,604", "State session laws"],
];

export default function CoverageMap() {
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; w: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; id: number } | null>(null);
  const { z: zoom, x: panX, y: panY } = view;
  const count = (name: string) => jurisdictions.find((j) => j.name === name)?.sections ?? 0;
  const label = (name: string, n: number) => `${name}: ${n.toLocaleString()} statute sections`;
  const [vw, vh] = US_MAP_VIEWBOX.split(" ").slice(2).map(Number);

  const apply = useCallback((v: { z: number; x: number; y: number }) => {
    // keep the map covering the viewport: pan is limited to [vw*(1-z), 0]
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    const next = { z, x: Math.min(0, Math.max(vw * (1 - z), v.x)), y: Math.min(0, Math.max(vh * (1 - z), v.y)) };
    viewRef.current = next;
    setView(next);
  }, [vw, vh]);

  // Zoom by factor f keeping the viewBox point (cx, cy) fixed under the pointer.
  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    const { z, x, y } = viewRef.current;
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * f));
    const k = nz / z;
    apply({ z: nz, x: cx - (cx - x) * k, y: cy - (cy - y) * k });
  }, [apply]);

  // Wheel / trackpad scroll over the map zooms it. Needs a non-passive native listener so the page cannot scroll;
  // data-lenis-prevent on the card also tells Lenis to ignore the event.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dy = Math.max(-120, Math.min(120, e.deltaY * unit));
      const r = svg.getBoundingClientRect();
      zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0018)), (e.clientX - r.left) * (vw / r.width), (e.clientY - r.top) * (vh / r.height));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt, vw, vh]);

  // Tooltip position relative to the map card, from a mouse event or (for keyboard focus) the element's centre.
  const place = (e: { clientX: number; clientY: number }) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
  };
  const placeEl = (el: Element) => {
    const b = el.getBoundingClientRect();
    place({ clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
  };
  const hoverHandlers = (name: string) => ({
    onMouseEnter: (e: React.MouseEvent) => { setHover(name); place(e); },
    onMouseMove: (e: React.MouseEvent) => place(e),
    onMouseLeave: () => { setHover(null); setTip(null); },
    onFocus: (e: React.FocusEvent) => { setHover(name); placeEl(e.currentTarget); },
    onBlur: () => { setHover(null); setTip(null); },
  });

  const zoomBy = (f: number) => zoomAt(f, vw / 2, vh / 2);
  const reset = () => apply({ z: 1, x: 0, y: 0 });
  const ctl = "flex h-8 w-8 items-center justify-center rounded-control border border-border bg-surface text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-40";

  return (
    <section className="bg-dark px-4 py-16 text-background sm:px-6 sm:py-24 lg:px-8" id="coverage">
      <div className="mx-auto max-w-[1152px]">
        <Reveal>
          <h2 className="font-serif text-[34px] leading-tight sm:text-[48px]">Every US jurisdiction, in one consistent format.</h2>
          <DevOnly><p className="mt-3 text-[14px] text-background/60">US map: <MockBadge>state outlines recreated from the public page</MockBadge> Per-state counts are figures seen on the public page.</p></DevOnly>
        </Reveal>

        <div className="relative mt-8">
          <div ref={boxRef} className="relative overflow-hidden rounded-panel border border-border bg-surface">
            <svg ref={svgRef} viewBox={US_MAP_VIEWBOX} data-lenis-prevent className="block select-none" style={{ width: "100%", height: "auto", cursor: dragging ? "grabbing" : zoom > 1 ? "grab" : "default", touchAction: zoom > 1 ? "none" : "pan-y" }}
              onPointerDown={(e) => {
                if (zoom <= 1 || e.button !== 0) return;
                drag.current = { x: e.clientX, y: e.clientY, px: viewRef.current.x, py: viewRef.current.y, id: e.pointerId };
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(true);
              }}
              onPointerMove={(e) => {
                const d = drag.current; if (!d) return;
                const r = e.currentTarget.getBoundingClientRect();
                apply({ z: viewRef.current.z, x: d.px + (e.clientX - d.x) * (vw / r.width), y: d.py + (e.clientY - d.y) * (vh / r.height) });
              }}
              onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
              <g transform={`translate(${panX} ${panY}) scale(${zoom})`} style={{ transition: dragging ? "none" : "transform .12s ease-out" }}>
                <g transform="translate(-8.09 -12.36)">
                  {US_MAP.map((st) => {
                    const n = count(st.name);
                    return (
                      <path key={st.name} d={st.d} tabIndex={0} role="button" aria-label={label(st.name, n)}
                        {...hoverHandlers(st.name)}
                        className="us-state" style={{ fill: hover === st.name ? HOVER_FILL : LAYER_COLOR[st.l], transition: "fill 120ms" }} />
                    );
                  })}
                  <g transform="translate(779.48 224.51)">
                    <path d="M0,0 Q-18.2,7.7 -28,22" fill="transparent" stroke="#6e3730" strokeWidth={1} strokeLinecap="round" />
                    <text x={4} textAnchor="start" dominantBaseline="middle" fontSize={9} fontWeight={500} className="fill-foreground font-sans" aria-hidden="true">Washington, D.C.</text>
                  </g>
                </g>
              </g>
            </svg>
            <button type="button" aria-label={label(PR.name, PR.sections)} {...hoverHandlers(PR.name)}
              className="absolute bottom-3 left-24 z-10 flex h-9 w-14 items-center justify-center rounded-control border border-border text-[10px] font-semibold text-white shadow-sm transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              style={{ backgroundColor: LAYER_COLOR[2] }}>PR</button>
            {hover && tip && !dragging && (() => {
              const bd = stateBreakdown[hover];
              if (!bd) return null;
              const half = 128 + 8; // w-64 card, kept inside the map card
              const x = Math.min(Math.max(tip.x, half), tip.w - half);
              const below = tip.y < 220;
              const rows: [string, string][] = [["Statutes", bd.s], ["Regulations", bd.r], ["Constitution", bd.c], ["Court rules", bd.ct]];
              return (
                <div role="tooltip" className="pointer-events-none absolute z-20 w-64 rounded-panel border border-border bg-surface p-3.5 text-left text-foreground shadow-lg"
                  style={{ left: x, top: tip.y, transform: `translate(-50%, ${below ? "16px" : "calc(-100% - 16px)"})` }}>
                  <p className="font-serif text-base">{hover}</p>
                  <dl className="mt-2 space-y-1 text-xs">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="font-mono font-semibold">{v}</dd></div>
                    ))}
                    {bd.ag && (
                      <div className="mt-1 border-t border-border pt-2">
                        <dt className="text-muted">Agency guidance</dt><dd className="font-mono font-semibold">{bd.ag}</dd>
                        {bd.src && <dd className="mt-0.5 text-[11px] leading-snug text-muted">{bd.src}</dd>}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-border pt-1.5"><dt className="text-muted">Total sections</dt><dd className="font-mono font-semibold text-primary">{bd.t}</dd></div>
                  </dl>
                </div>
              );
            })()}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
              <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)} disabled={zoom >= MAX_ZOOM} className={ctl}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
              </button>
              <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)} disabled={zoom <= MIN_ZOOM} className={ctl}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /></svg>
              </button>
              <button type="button" aria-label="Reset zoom" onClick={reset} className={ctl}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            {layers.map((l, i) => (
              <div key={l} className="flex items-center gap-2 text-xs text-background/70">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-control" style={{ backgroundColor: LAYER_COLOR[i as 0 | 1 | 2] }} />{l}
              </div>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">{hover ? label(hover, hover === PR.name ? PR.sections : count(hover)) : ""}</p>
        </div>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-panel bg-background/10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([v, l]) => (
            <div key={l} className="bg-dark p-5"><dt className="font-serif text-[30px] text-background">{v}</dt><dd className="mt-1 text-[14px] text-background/60">{l}</dd></div>
          ))}
        </dl>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            ["Federal agency guidance", "How agencies say they read their own rules. Guidance is not binding law, and it is stored separately from law that is."],
            ["Federal administrative adjudications", "Decisions from executive-branch tribunals, served as they were issued. Check these the way you would check any decision."],
            ["Federal courts’ own rules", "Local rules from many rule sets, each taken from the court’s own site."],
          ].map(([h, p]) => (
            <div key={h}><h3 className="text-[18px] font-semibold">{h}</h3><p className="mt-2 text-[15px] leading-relaxed text-background/70">{p}</p></div>
          ))}
        </div>

        <dl className="mt-10 grid gap-4 border-t border-background/15 pt-6 text-[15px] sm:grid-cols-3">
          {[["CFR", "Refreshed daily"], ["US Code", "Refreshed weekly"], ["State regulations", "Refreshed monthly"]].map(([a, b]) => (
            <div key={a} className="flex justify-between gap-4 sm:block"><dt className="font-medium">{a}</dt><dd className="text-background/60">{b}</dd></div>
          ))}
        </dl>
      </div>
    </section>
  );
}
