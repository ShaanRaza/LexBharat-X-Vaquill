import type { Metadata } from "next";
import { Schibsted_Grotesk, Source_Code_Pro, Newsreader } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import DataAttribution from "@/components/DataAttribution";
import { RELEASE } from "@/lib/release";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Source_Code_Pro({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// The public site's display serif could not be identified; Newsreader is an approximation.
const serif = Newsreader({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: RELEASE ? "LexBharat | US primary law API" : "LexBharat | US primary law API (local mock)",
  description:
    RELEASE ? "LexBharat: an open API for US primary law, with a source link on every section." : "LexBharat: local educational build of an API marketing page. Placeholder content and mocked backend.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">Skip to main content</a>
        <SmoothScroll />
        {children}
        <DataAttribution />
      </body>
    </html>
  );
}
