import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.56.1"],
  // Optimize for Vercel serverless deployment
  experimental: {
    // Enable faster page loads
    optimizePackageImports: ["lucide-react"],
  },
  // Set reasonable timeouts for API routes (Vercel max is 60s on hobby plan)
  serverExternalPackages: ["pg"],
};

export default nextConfig;
