import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '26mb',
    },
  },
  serverExternalPackages: ['pdf-parse', '@xenova/transformers'],
};

export default nextConfig;
