/** @type {import('next').NextConfig} */
// The High Court export (data/judgments-hc, data/judgments-hc-gz: hundreds of thousands of files) is read at runtime from JUDGMENTS_DATA_DIR in
// development or fetched from JUDGMENTS_DATA_URL in production. It must never be traced into a build: tracing it exhausts memory.
// the PDF export reads its fonts (src/lib/drafting/fonts) at run time, so that folder is added to the files traced for the export route
const nextConfig = { reactStrictMode: true, outputFileTracingIncludes: { "/api/drafting/[id]/export": ["./src/lib/drafting/fonts/**/*"] }, outputFileTracingExcludes: { "*": ["data/**/*", ".next/cache/**/*", ".git/**/*", "docs/**/*", "qa/**/*", "scripts/**/*", "public/**/*.mp4"] } };
export default nextConfig;
