import "server-only";
import { saasEnabled, rootDomain } from "@/lib/tenant-context";
import { classifyHost, currentTenantRecord, requestHost, requestProto } from "@/lib/tenant";
import { getSetting } from "@/lib/queries";
import { tenantState } from "@/lib/platform";
import type { CafeInfo, Menu, MenuItem } from "@/lib/types";

/**
 * ابزارهای سئو: آدرسِ اصلی (canonical) هر صفحه، و دادهٔ ساختاریافته (JSON-LD) برای گوگل.
 * برای مجموعه‌ای که دامنهٔ اختصاصی دارد، آدرسِ اصلی همان دامنه است (نه زیردامنه).
 */
export async function siteOrigin(): Promise<string> {
  const proto = await requestProto();
  const { host, port } = await requestHost();
  if (saasEnabled()) {
    const info = classifyHost(host);
    if (info.kind === "platform") return `${proto}://${rootDomain()}${port}`;
    if (info.kind === "tenant" && info.tenant.domain) return `${proto}://${info.tenant.domain}${port}`;
  }
  return `${proto}://${host}${port}`;
}

export const isImgSrc = (s?: string) => /^(\/|https?:)/.test(s || "");
export const absUrl = (origin: string, src: string) => (/^https?:/.test(src) ? src : `${origin}${src}`);

/** مجموعهٔ فعلی در دسترسِ مشتری است؟ (منقضی/تعلیق ← از نتایجِ جستجو بیرون) */
export function tenantIndexable(): boolean {
  const t = currentTenantRecord();
  return !t || tenantState(t).active;
}

/** قیمت به ریال (واحدِ استانداردِ schema.org برای ایران: IRR) */
export const toRial = (n: number, currency: CafeInfo["currency"]) => (currency === "rial" ? n : n * 10);

/** نوعِ schema.org بر اساسِ نوعِ کسب‌وکار */
const SCHEMA_TYPE: Record<string, string> = { cafe: "CafeOrCoffeeShop", restaurant: "Restaurant", fastfood: "FastFoodRestaurant", other: "FoodEstablishment" };

export function cafeDescription(cafe: CafeInfo, menu?: Menu): string {
  if (cafe.seoDescription) return cafe.seoDescription;
  const cats = menu ? menu.categories.slice(0, 4).map((c) => c.name).join("، ") : "";
  return [
    `منوی ${cafe.name}${cafe.city ? ` در ${cafe.city}` : ""} با قیمت‌های به‌روز${cats ? ` — ${cats}` : ""}.`,
    cafe.tagline || "سفارش آنلاین سرِ میز، درخواستِ گارسون و پرداخت از گوشی.",
  ].join(" ");
}

/** JSON-LD رستوران/کافه همراهِ منوی کامل */
export function restaurantJsonLd(origin: string, cafe: CafeInfo, menu: Menu) {
  const kind = cafe.kind || "cafe";
  const items = (cat: string) => menu.items.filter((i) => i.category === cat && i.available);
  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[kind] || "FoodEstablishment",
    "@id": `${origin}/#business`,
    name: cafe.name,
    url: `${origin}/`,
    description: cafeDescription(cafe, menu),
    ...(isImgSrc(cafe.logo) ? { logo: absUrl(origin, cafe.logo), image: absUrl(origin, cafe.logo) } : {}),
    ...(cafe.phone ? { telephone: cafe.phone } : {}),
    ...(cafe.address ? { address: { "@type": "PostalAddress", streetAddress: cafe.address, ...(cafe.city ? { addressLocality: cafe.city } : {}), addressCountry: "IR" } } : {}),
    ...(cafe.mapUrl ? { hasMap: cafe.mapUrl } : {}),
    ...(cafe.instagram ? { sameAs: [/^https?:/.test(cafe.instagram) ? cafe.instagram : `https://instagram.com/${cafe.instagram.replace(/^@/, "")}`] } : {}),
    currenciesAccepted: "IRR",
    acceptsReservations: false,
    hasMenu: {
      "@type": "Menu",
      name: `منوی ${cafe.name}`,
      url: `${origin}/`,
      hasMenuSection: menu.categories.filter((c) => items(c.id).length).map((c) => ({
        "@type": "MenuSection",
        name: c.name,
        hasMenuItem: items(c.id).map((i) => menuItemLd(origin, cafe, i)),
      })),
    },
  };
}

export function menuItemLd(origin: string, cafe: CafeInfo, i: MenuItem) {
  return {
    "@type": "MenuItem",
    name: i.name,
    url: `${origin}/p/${encodeURIComponent(i.id)}`,
    ...(i.desc ? { description: i.desc } : {}),
    ...(i.image ? { image: absUrl(origin, i.image) } : {}),
    offers: { "@type": "Offer", price: toRial(i.price, cafe.currency), priceCurrency: "IRR", availability: i.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
}

export function cafeInfo(): CafeInfo {
  return getSetting<CafeInfo>("cafe", { name: "منوی دیجیتال", logo: "", tagline: "", currency: "toman" });
}

/** صفحه‌هایی که نباید در گوگل بیایند */
export const NOINDEX = { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } } as const;

/** JSON-LD سایتِ پلتفرم: سازمان، وب‌سایت، نرم‌افزار (با قیمتِ طرح‌ها) و سؤالاتِ رایج */
export function platformJsonLd(origin: string, c: import("@/lib/site-content").SiteContent, plans: { title: string; months: number; price: number }[]) {
  const f = c.footer;
  const sameAs = [
    f.instagram && (/^https?:/.test(f.instagram) ? f.instagram : `https://instagram.com/${f.instagram.replace(/^@/, "")}`),
    f.telegram && (/^https?:/.test(f.telegram) ? f.telegram : `https://t.me/${f.telegram.replace(/^@/, "")}`),
  ].filter(Boolean);
  // نامِ دیگرِ برند (مثلاً «منوچی» و «menuchii») تا جستجوی هر دو به همین سایت برسد
  const alternateName = [...new Set([new URL(origin).hostname.replace(/^www\./, "").split(".")[0], new URL(origin).hostname.replace(/^www\./, "")])].filter((n) => n && n !== c.brand.name);
  const org = {
    "@type": "Organization", "@id": `${origin}/#org`, name: c.brand.name, alternateName, url: `${origin}/`,
    ...(isImgSrc(c.brand.logo) ? { logo: absUrl(origin, c.brand.logo) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(f.phone || f.email ? { contactPoint: { "@type": "ContactPoint", contactType: "customer support", availableLanguage: "fa", ...(f.phone ? { telephone: f.phone } : {}), ...(f.email ? { email: f.email } : {}) } } : {}),
  };
  const graph: Record<string, unknown>[] = [
    org,
    { "@type": "WebSite", "@id": `${origin}/#site`, name: c.brand.name, alternateName, url: `${origin}/`, inLanguage: "fa-IR", publisher: { "@id": `${origin}/#org` } },
    {
      "@type": "SoftwareApplication", name: c.brand.name, applicationCategory: "BusinessApplication", operatingSystem: "Web",
      description: c.brand.seoDescription, url: `${origin}/`, inLanguage: "fa-IR", publisher: { "@id": `${origin}/#org` },
      offers: plans.filter((p) => p.price > 0).map((p) => ({ "@type": "Offer", name: p.title, price: p.price * 10, priceCurrency: "IRR", url: `${origin}/signup` })),
    },
  ];
  if (c.faq.items.length) {
    graph.push({ "@type": "FAQPage", mainEntity: c.faq.items.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

/** مسیرِ راهنما برای نتایجِ گوگل */
export function breadcrumbLd(origin: string, items: { name: string; path?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, ...(it.path !== undefined ? { item: `${origin}${it.path}` } : {}) })),
  };
}

/** مقالهٔ وبلاگ */
export function articleLd(origin: string, a: { slug: string; title: string; description: string; cover: string; date: string; updated: string }, brand: string, logo: string) {
  const url = `${origin}/blog/${a.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: url,
    headline: a.title.slice(0, 110),
    description: a.description,
    inLanguage: "fa-IR",
    datePublished: a.date,
    dateModified: a.updated || a.date,
    image: [absUrl(origin, a.cover || "/og.png")],
    author: { "@type": "Organization", name: brand, url: `${origin}/` },
    publisher: { "@type": "Organization", "@id": `${origin}/#org`, name: brand, ...(isImgSrc(logo) ? { logo: { "@type": "ImageObject", url: absUrl(origin, logo) } } : {}) },
  };
}

/** صفحهٔ موضوعی: خدمت + سؤالاتِ رایج */
export function solutionLd(origin: string, s: { slug: string; h1: string; description: string; faq: { q: string; a: string }[] }, brand: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service", "@id": `${origin}/${s.slug}#service`, name: s.h1, description: s.description, serviceType: s.h1,
        areaServed: { "@type": "Country", name: "Iran" }, provider: { "@type": "Organization", "@id": `${origin}/#org`, name: brand }, url: `${origin}/${s.slug}`,
      },
      { "@type": "FAQPage", mainEntity: s.faq.map((q) => ({ "@type": "Question", name: q.q, acceptedAnswer: { "@type": "Answer", text: q.a } })) },
    ],
  };
}
