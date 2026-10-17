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
  poweredByHeader: false,
  // سرآیندهای امنیتی روی همهٔ صفحه‌ها (HSTS در Nginx، فقط روی HTTPS)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // دوربین فقط برای اسکنِ QR در همین سایت
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          // CSP (با nonceِ هر درخواست) و HSTS در middleware.ts
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
