/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["pg", "bcryptjs", "sharp"],
    // src/instrumentation.ts: seed accounts + in-process dawn batch (non-AWS hosting)
    instrumentationHook: true,
  },
};

export default nextConfig;
