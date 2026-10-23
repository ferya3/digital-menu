import { Landing } from "@/components/landing";
import { getMenu, getSetting } from "@/lib/queries";
import type { CafeInfo, PaymentInfo, SmsSettings } from "@/lib/types";
import { tenantPage } from "@/lib/tenant-page";
import type { Metadata } from "next";
import { onPlatformHost } from "@/lib/tenant";
import { JsonLd } from "@/components/json-ld";
import { PoweredBy } from "@/components/powered-by";
import { platformJsonLd, restaurantJsonLd, siteOrigin } from "@/lib/seo";
import { PlatformHome } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";
import { publishedArticles } from "@/lib/platform-admin";
import { fill } from "@/lib/site-content";
import { toFa } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** آدرسِ اصلی بدونِ ?table= (همهٔ QRها یک صفحه حساب شوند، نه صفحه‌های تکراری) */
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: { canonical: "/" } };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  // دامنهٔ اصلیِ پلتفرم: صفحهٔ معرفی و تعرفه‌ها
  if (await onPlatformHost()) {
    const p = publicPlatform();
    const vars = { brand: p.c.brand.name, trialDays: toFa(p.trialDays), root: p.root };
    const articles = publishedArticles().slice(0, 3).map((x) => ({ slug: x.slug, title: fill(x.title, vars), description: fill(x.description, vars) }));
    return <><JsonLd data={platformJsonLd(await siteOrigin(), p.c, p.plans)} /><PlatformHome p={p} articles={articles} /></>;
  }
  const origin = await siteOrigin();
  const sp = await searchParams;
  // بدون شماره میز (مثلاً بازکردنِ آدرسِ خالیِ سایت) = صفحهٔ «QR میز را اسکن کنید»؛ دیگر پیش‌فرضِ میز ۱ نداریم
  const table = String(sp.table || "").trim().slice(0, 20);
  // منوی مجموعهٔ همین زیردامنه؛ اشتراکِ تمام‌شده = صفحهٔ «موقتاً در دسترس نیست»
  return tenantPage(() => {
  const menu = getMenu();
  const cafe = getSetting<CafeInfo>("cafe", {
    name: "کافه آرتاویل",
    logo: "☕",
    tagline: "",
    currency: "toman",
  });
  const payment = getSetting<PaymentInfo>("payment", {
    card: "",
    holder: "",
    note: "",
    link: "",
  });

  const otp = !!getSetting<Partial<SmsSettings>>("sms", {}).otpEnabled;
  const payFirst = getSetting<boolean>("payFirst", true) !== false;

  return (
    <>
      <JsonLd data={restaurantJsonLd(origin, cafe, menu)} />
      <Landing menu={menu} table={table} cafe={cafe} payment={payment} otp={otp} payFirst={payFirst} />
      <PoweredBy />
    </>
  );
  }, { active: true });
}
