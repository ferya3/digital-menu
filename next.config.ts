import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Images are compressed on the user's device; this limit is just a safety net
    serverActions: { bodySizeLimit: "10mb" },
  },
  // sharp must be loaded from node_modules on the server, not bundled
  serverExternalPackages: ["sharp"],
  poweredByHeader: false,
  // Security headers: pages get them in middleware.ts (with CSP and HSTS); this also covers static /_next files
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera only for QR scanning on this site
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          // CSP (with a per-request nonce) and HSTS are set in middleware.ts
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
