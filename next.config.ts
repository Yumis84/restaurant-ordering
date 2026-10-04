import type { NextConfig } from "next";

const deploymentMode = process.env.PAGES_DEPLOYMENT_MODE || "github-pages";
const isServer = deploymentMode === "server";
const isCustomDomain = deploymentMode === "custom-domain";

const nextConfig: NextConfig = {
  // Customer storefront remains a static GitHub Pages export by default.
  // Staff KDS/API routes require a real Next.js server runtime.
  output: isServer || deploymentMode === "development" ? undefined : "export",
  trailingSlash: true,
  basePath: isServer || isCustomDomain ? "" : "/shavalleya-pages",
  assetPrefix: isServer || isCustomDomain ? undefined : "/shavalleya-pages/",
  images: { unoptimized: true },
  ...(isServer ? {
    async headers() {
      return [{
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      }]
    },
  } : {}),
};

export default nextConfig;
