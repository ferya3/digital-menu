import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "کافه آرتاویل — منوی دیجیتال",
  description:
    "منوی دیجیتال، سفارش آنلاین، درخواست گارسون و صورتحساب کافه آرتاویل.",
};

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
