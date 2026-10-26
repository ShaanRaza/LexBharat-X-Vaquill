import Link from "next/link";
import Reveal from "./Reveal";
import MockBadge from "./MockBadge";
import DevOnly from "@/components/DevOnly";

// Fictional placeholder comments (no real people or posts).
const comments = [
  { name: "Sam Sample", role: "Founder, Demo Labs", when: "3w", likes: 42, color: "var(--primary)", dy: -6, rot: -1.2, text: "Finally a clean, citable source for state statutes. Pulling it in this weekend." },
  { name: "Riya Example", role: "Legal engineer", when: "3w", likes: 18, color: "rgb(var(--legacy-3b302b-rgb))", dy: 8, rot: 0.8, text: "The consistent format across 50 states is the part nobody else bothered to build." },
  { name: "Alex Placeholder", role: "Staff engineer, Acme Legal", when: "2w", likes: 27, color: "rgb(var(--legacy-a8706a-rgb))", dy: -2, rot: 1.4, text: "Open-sourcing the dataset is a big deal for anyone building legal AI. Thank you!" },
  { name: "Jordan Demo", role: "Attorney", when: "2w", likes: 9, color: "rgb(var(--legacy-54403a-rgb))", dy: 10, rot: -0.7, text: "Source links on every section make verifying an answer a ten-second job." },
  { name: "Maya Fictional", role: "Product, Sample Policy Co.", when: "1w", likes: 31, color: "rgb(var(--legacy-6e4e42-rgb))", dy: -8, rot: 1, text: "Tried the MCP server with my agent and the citations came back first try." },
  { name: "Chris Lorem", role: "Researcher", when: "1w", likes: 14, color: "var(--primary)", dy: 4, rot: -1.5, text: "Great for academic work: reproducible, versioned, and easy to cite." },
  { name: "Dana Mockford", role: "Compliance lead, Demo Lending", when: "1w", likes: 22, color: "rgb(var(--legacy-54403a-rgb))", dy: -4, rot: 0.9, text: "We replaced three scrapers with one API call. The change alerts alone are worth it." },
  { name: "Priya Sample", role: "Founder, Fictional Labs", when: "5d", likes: 36, color: "rgb(var(--legacy-a8706a-rgb))", dy: 6, rot: -1, text: "Fresh data, real source links, and a format my agents actually understand." },
];
const rows = [comments.slice(0, 4), comments.slice(4)];


const logos = ["Acme Legal", "Northwind Compliance", "Lorem & Ipsum LLP", "Fictional Labs", "Sample Policy Co.", "Demo Lending", "Placeholder Law PLLC", "Example Firm Ltd."];

export default function Proof() {
  return (
    <>
      <section className="px-4 pb-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-w1152">
          <Reveal>
            <figure className="relative grid aspect-video max-w-w1152 place-items-center overflow-hidden rounded-panel bg-dark">
              <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--primary-glow-soft),transparent_60%)]" />
              <button className="relative flex items-center gap-3 rounded-full bg-background px-6 py-3 text-fs-lead font-medium transition-transform hover:scale-[1.03]">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white">▶</span>
                Watch the full film <span className="text-muted">1:21</span>
              </button>
              <figcaption className="absolute bottom-3 right-3"><MockBadge>placeholder video</MockBadge></figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8" aria-label="Who uses it">
        <div className="mx-auto max-w-w1152 text-center">
          <p className="text-fs-body text-muted">Trusted by <span className="font-medium text-foreground">1,300+ accounts</span> across <span className="font-medium text-foreground">150+ organizations</span> <MockBadge>placeholder figures</MockBadge></p>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {logos.map((l) => (
              <li key={l} className="font-serif text-fs-20 italic text-muted">{l}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-label="What customers say">
        <div className="mx-auto max-w-w1152">
          <Reveal>
            <h2 className="text-fs-display font-semibold tracking-tight">In their words</h2>
            <figure className="mt-6 max-w-w760 border-l-4 border-primary pl-6">
              <blockquote className="font-serif text-fs-30 leading-snug">
                “Placeholder testimonial: this is where a customer would describe how verifiable source links changed their workflow.”
              </blockquote>
              <figcaption className="mt-4 text-fs-body text-muted">Jane Placeholder · Attorney, Example Law PLLC <MockBadge>fictional</MockBadge></figcaption>
              <Link href="/customer" className="mt-2 inline-block py-1.5 text-fs-body text-primary underline-offset-4 hover:underline">Read the story</Link>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-6 lg:px-8" aria-label="Community reactions">
        <div className="mx-auto max-w-w1152">
          <h2 className="max-w-w640 text-fs-display font-semibold tracking-tight">What builders said when the dataset was open-sourced.</h2>
        </div>
        <div className="comment-marquee-group relative mx-auto mt-8 max-w-w1280 overflow-hidden py-6" style={{ maskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 4%, black 96%, transparent)" }}>
          {rows.map((row, r) => (
            <ul key={r} className={`${r ? "comment-marquee-reverse mt-4" : "comment-marquee"} flex w-max items-start gap-4 pr-4`}>
              {[...row, ...row].map((c, i) => (
                <li key={i} aria-hidden={i >= row.length || undefined}
                  className="w-72 shrink-0 self-center rounded-panel border border-border bg-surface p-4 shadow-pop sm:w-80"
                  style={{ transform: `translateY(${c.dy}px) rotate(${c.rot}deg)` }}>
                  <div className="flex items-center gap-2.5">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fs-sm font-semibold text-white" style={{ backgroundColor: c.color }}>{c.name.split(" ").map((w) => w[0]).join("")}</span>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-fs-ui font-semibold">{c.name}</p>
                      <p className="truncate text-fs-xs text-muted">{c.role}</p>
                    </div>
                    <span className="ml-auto text-fs-xs text-muted">{c.when}</span>
                  </div>
                  <p className="mt-3 text-fs-ui leading-relaxed">{c.text}</p>
                  <p className="mt-3 text-fs-xs text-muted">Like · Reply · {c.likes} reactions</p>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <div className="mx-auto max-w-w1152"><DevOnly><p className="mt-1 text-fs-sm text-muted">Fictional comment cards standing in for social-media comments.</p></DevOnly></div>
      </section>
    </>
  );
}
