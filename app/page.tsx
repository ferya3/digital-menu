import { Landing } from "@/components/landing";
import { getMenu, getSetting } from "@/lib/queries";
import type { CafeInfo, PaymentInfo, SmsSettings } from "@/lib/types";
import { tenantPage } from "@/lib/tenant-page";
import type { Metadata } from "next";
import { onPlatformHost } from "@/lib/tenant";
import { JsonLd } from "@/components/json-ld";
import { onlinePaymentEnabled } from "@/lib/order-pay";
import { PoweredBy } from "@/components/powered-by";
import { platformJsonLd, restaurantJsonLd, siteOrigin } from "@/lib/seo";
import { PlatformHome } from "@/components/platform/home";
import { publicPlatform } from "@/app/platform/public";
import { demoInfo } from "@/app/platform/demo";
import { listCities, publishedArticles } from "@/lib/platform-admin";
import { fill } from "@/lib/site-content";
import { num } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Canonical URL without ?table= (all table QRs count as one page, not duplicates) */
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: { canonical: "/" } };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  // Platform root domain: marketing and pricing page
  if (await onPlatformHost()) {
    const p = publicPlatform();
    const vars = { brand: p.c.brand.name, trialDays: num(p.trialDays), root: p.root };
    const articles = publishedArticles().slice(0, 3).map((x) => ({ slug: x.slug, title: fill(x.title, vars), description: fill(x.description, vars) }));
    const demo = await demoInfo(p.c.hero.demoSlug, p.c.hero.demoLabel);
    return <><JsonLd data={platformJsonLd(await siteOrigin(), p.c, p.plans, p.currency)} /><PlatformHome p={p} articles={articles} demo={demo} cities={listCities().filter((x) => x.published).map((x) => ({ slug: x.slug, name: x.name }))} /></>;
  }
  const origin = await siteOrigin();
  const sp = await searchParams;
  // No table number (e.g. the bare site address) = "Scan your table QR" screen; there is no default table
  const table = String(sp.table || "").trim().slice(0, 20);
  // Menu of this subdomain's venue; an expired subscription shows the "temporarily unavailable" page
  return tenantPage(() => {
  const menu = getMenu();
  const cafe = getSetting<CafeInfo>("cafe", {
    name: "My Café",
    logo: "☕",
    tagline: "",
    currency: "USD",
  });
  const payment: PaymentInfo = {
    ...getSetting<PaymentInfo>("payment", { card: "", holder: "", note: "", link: "" }),
    online: onlinePaymentEnabled(),
  };

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
