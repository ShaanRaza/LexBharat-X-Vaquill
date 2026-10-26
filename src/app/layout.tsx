import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Devanagari, Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import DataAttribution from "@/components/DataAttribution";
import { RELEASE } from "@/lib/release";
import AccessDevBanner from "@/components/AccessDevBanner";
import VisitPing from "@/components/VisitPing";
import { Analytics } from "@vercel/analytics/next";

// Fonts of the reskin (all free, OFL): Geist for text and UI, Geist Mono for small labels and code, Source Serif 4 for headings (self-hosted: weight 400 with its optical-size axis, copied from the design repo),
// IBM Plex Sans Devanagari for Hindi. The Devanagari file is not preloaded and is only fetched when a page actually shows Devanagari text (the browser downloads it by unicode-range).
const sans = Geist({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });
const serif = localFont({ src: "./fonts/source-serif-4-opsz-400.woff2", weight: "400", style: "normal", variable: "--font-serif", display: "swap", adjustFontFallback: "Times New Roman" });
// the bold serif of the wordmark ("Bharat"): weight 600 only, so the logo never uses a synthesised bold
const serifStrong = Source_Serif_4({ subsets: ["latin"], weight: ["600"], variable: "--font-serif-strong", display: "swap" });
const deva = IBM_Plex_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500"], variable: "--font-deva", display: "swap", preload: false });

export const metadata: Metadata = {
  title: RELEASE ? "LexBharat | Indian Acts and court judgments" : "LexBharat | Indian Acts and court judgments (local mock)",
  description:
    RELEASE ? "LexBharat: browse Indian Acts and court judgment metadata, with the source credited on every page." : "LexBharat: local educational build of an API marketing page. Placeholder content and mocked backend.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${serifStrong.variable} ${deva.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">Skip to main content</a>
        <AccessDevBanner />
        <SmoothScroll />
        {children}
        <DataAttribution />
        <VisitPing />
        <Analytics />   {/* Vercel Web Analytics (free): collects nothing until it is switched on in the Vercel dashboard */}
      </body>
    </html>
  );
}
