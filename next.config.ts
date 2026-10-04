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
};

export default nextConfig;
