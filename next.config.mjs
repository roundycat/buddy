/**
 * Response headers for every page and API route. Kept to what the app can
 * live with: the voice input needs the microphone, today's weather a coarse
 * location, and photo uploads the camera — all from this site only.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nobody may frame the app (a child's chat inside someone else's page)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()" },
  // Browsers ignore this over plain http (local runs); deployments are https
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["pg", "bcryptjs", "sharp"],
    // src/instrumentation.ts: seed accounts + in-process dawn batch (non-AWS hosting)
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
