import type { NextConfig } from "next";

const backendUrl = (process.env.BACKEND_API_URL || 'https://billflow-backend-ntt5.onrender.com').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
