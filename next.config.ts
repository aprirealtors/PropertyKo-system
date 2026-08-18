import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.100.55'],
  output: "export",
  trailingSlash: true, // <--- Fixes the 403 error on GoDaddy
  images: {
    unoptimized: true, // <--- Required for static export
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