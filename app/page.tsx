import { Landing } from "@/components/landing";
import { getMenu, getSetting } from "@/lib/queries";
import type { CafeInfo, PaymentInfo, SmsSettings } from "@/lib/types";
import { tenantPage } from "@/lib/tenant-page";
import type { Metadata } from "next";
import { onPlatformHost } from "@/lib/tenant";
import { JsonLd } from "@/components/json-ld";
import { platformJsonLd, restaurantJsonLd, siteOrigin } from "@/lib/seo";
import { PlatformHome } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";

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
    return <><JsonLd data={platformJsonLd(await siteOrigin(), p.c, p.plans)} /><PlatformHome p={p} /></>;
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
    </>
  );
  }, { active: true });
}
