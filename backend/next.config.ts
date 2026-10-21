import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone Next.js API web service for Render
  serverExternalPackages: ['mongodb', 'better-auth'],
};

export default nextConfig;
