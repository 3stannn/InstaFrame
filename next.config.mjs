/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel's Next.js adapter expects .next. Isolate only local production builds
  // so they do not overwrite a development preview running in the workspace.
  distDir: process.env.VERCEL === "1" || process.env.NODE_ENV === "development"
    ? ".next"
    : ".next-production",
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/proxy": ["./public/preview-bridge.js"],
    "/api/screenshot": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
