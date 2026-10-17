import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { headers } from "next/headers";
import { saasEnabled } from "@/lib/tenant-context";
import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { fillContent, siteContent } from "@/lib/platform-admin";
import { getMenu } from "@/lib/queries";
import { NOINDEX, cafeDescription, cafeInfo, isImgSrc, siteOrigin, tenantIndexable } from "@/lib/seo";

/**
 * سئو: عنوان (با الگو برای زیرصفحه‌ها)، توضیح، تصویرِ اشتراک‌گذاری، آیکون و تأییدِ گوگل.
 * آدرسِ اصلیِ (canonical) هر صفحه در خودِ صفحه تعیین می‌شود.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const origin = await siteOrigin();
    const base = { metadataBase: new URL(origin), formatDetection: { telephone: false, address: false, email: false } };
    if (saasEnabled() && classifyHost((await requestHost()).host).kind === "platform") {
      const c = siteContent();
      const title = fillContent(c.brand.seoTitle, c), description = fillContent(c.brand.seoDescription, c);
      const image = c.brand.ogImage || "/og.png";
      return {
        ...base,
        title: { default: title, template: `%s | ${c.brand.name}` },
        description,
        applicationName: c.brand.name,
        openGraph: { type: "website", locale: "fa_IR", siteName: c.brand.name, title, description, images: [{ url: image, width: 1200, height: 630, alt: c.brand.name }] },
        twitter: { card: "summary_large_image", title, description, images: [image] },
        ...(isImgSrc(c.brand.logo) ? { icons: { icon: c.brand.logo, apple: c.brand.logo } } : {}),
        ...(c.brand.googleVerification ? { verification: { google: c.brand.googleVerification } } : {}),
      };
    }
    return await withTenant(() => {
      const cafe = cafeInfo();
      const title = `منوی ${cafe.name}${cafe.city ? ` ${cafe.city}` : ""} | قیمت‌ها و سفارش آنلاین`;
      const description = cafeDescription(cafe, getMenu());
      const image = cafe.heroPoster || "/og.png";
      return {
        ...base,
        title: { default: title, template: `%s | ${cafe.name}` },
        description,
        applicationName: cafe.name,
        openGraph: { type: "website", locale: "fa_IR", siteName: cafe.name, title, description, images: [{ url: image, ...(cafe.heroPoster ? {} : { width: 1200, height: 630 }), alt: cafe.name }] },
        twitter: { card: "summary_large_image", title, description, images: [image] },
        ...(isImgSrc(cafe.logo) ? { icons: { icon: `${cafe.logo}?w=160`, apple: `${cafe.logo}?w=320&f=jpg` } } : {}),
        ...(tenantIndexable() ? {} : NOINDEX),
      };
    });
  } catch {
    return { title: "منوی دیجیتال", ...NOINDEX };
  }
}

export const viewport: Viewport = {
  themeColor: "#1a1210",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}
try{if(sessionStorage.getItem('cafe_splash_seen'))document.documentElement.classList.add('splash-seen')}catch(e){}`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // nonceِ CSP (از middleware) — بدونِ آن این اسکریپتِ کوچک هم اجرا نمی‌شد
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
