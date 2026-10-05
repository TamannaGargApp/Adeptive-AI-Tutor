import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // pdf.js (used to read attached PDFs in the browser) has an optional Node-only "canvas"
    // dependency that the browser never needs; don't try to bundle it.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;