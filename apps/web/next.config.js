/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@lovecoin/shared"],
  
  // Enable standalone output for Docker deployments
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  
  // Image optimization (configure for your CDN)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudfront.net",
      },
    ],
  },
};

module.exports = nextConfig;
