import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // عکس‌ها روی دستگاه کاربر فشرده می‌شوند؛ این سقف فقط برای احتیاط است
    serverActions: { bodySizeLimit: "10mb" },
  },
  // sharp باید روی سرور از node_modules خوانده شود، نه باندل
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
