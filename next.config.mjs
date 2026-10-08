/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds separate from a running development preview.
  distDir: process.env.NODE_ENV === "development" ? ".next" : ".next-production",
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
