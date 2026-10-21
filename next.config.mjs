/** @type {import('next').NextConfig} */
// The High Court export (data/judgments-hc, data/judgments-hc-gz: hundreds of thousands of files) is read at runtime from JUDGMENTS_DATA_DIR in
// development or fetched from JUDGMENTS_DATA_URL in production. It must never be traced into a build: tracing it exhausts memory.
const nextConfig = { reactStrictMode: true, outputFileTracingExcludes: { "*": ["data/**/*"] } };
export default nextConfig;
