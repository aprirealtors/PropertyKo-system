import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.100.46'],
  // output: "export", <-- REMOVED: Middleware requires a Node.js server and cannot be used with static export
  trailingSlash: true, 
  images: {
    unoptimized: true, 
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'oxvmhziogtcvocgxgrqe.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;