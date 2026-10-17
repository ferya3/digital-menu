import { Landing } from "@/components/landing";
import { getMenu, getSetting } from "@/lib/queries";
import type { CafeInfo, PaymentInfo, SmsSettings } from "@/lib/types";
import { tenantPage } from "@/lib/tenant-page";
import { onPlatformHost } from "@/lib/tenant";
import { PlatformHome } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  // دامنهٔ اصلیِ پلتفرم: صفحهٔ معرفی و تعرفه‌ها
  if (await onPlatformHost()) return <PlatformHome p={publicPlatform()} />;
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

  return <Landing menu={menu} table={table} cafe={cafe} payment={payment} otp={otp} payFirst={payFirst} />;
  }, { active: true });
}
