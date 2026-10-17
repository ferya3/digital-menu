import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { saasEnabled } from "@/lib/tenant-context";
import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { platformSettings } from "@/lib/platform";
import { getSetting } from "@/lib/queries";
import type { CafeInfo } from "@/lib/types";

/** عنوانِ صفحه: نامِ همان مجموعه (یا نامِ پلتفرم روی دامنهٔ اصلی) */
export async function generateMetadata(): Promise<Metadata> {
  try {
    if (saasEnabled() && classifyHost((await requestHost()).host).kind === "platform") {
      const p = platformSettings();
      return { title: `${p.brand} — ${p.tagline}`, description: p.tagline };
    }
    const cafe = await withTenant(() => getSetting<CafeInfo>("cafe", { name: "منوی دیجیتال", logo: "", tagline: "", currency: "toman" }));
    return { title: `${cafe.name} — منوی دیجیتال`, description: `منوی دیجیتال، سفارش آنلاین، درخواست گارسون و صورتحساب ${cafe.name}.` };
  } catch {
    return { title: "منوی دیجیتال" };
  }
}

export const viewport: Viewport = {
  themeColor: "#1a1210",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}
try{if(sessionStorage.getItem('cafe_splash_seen'))document.documentElement.classList.add('splash-seen')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
