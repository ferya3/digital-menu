import { Landing } from "@/components/landing";
import { getMenu, getSetting } from "@/lib/queries";
import type { CafeInfo, PaymentInfo, SmsSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const sp = await searchParams;
  const table = (sp.table || "1").toString();
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
}
