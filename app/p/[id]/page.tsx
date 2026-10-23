import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenu, getSetting } from "@/lib/queries";
import { formatMoney, thumb } from "@/lib/utils";
import type { CafeInfo } from "@/lib/types";
import { ProductShare } from "./share";
import { JsonLd } from "@/components/json-ld";
import { menuItemLd, siteOrigin } from "@/lib/seo";
import { withTenant } from "@/lib/tenant";
import { tenantPage } from "@/lib/tenant-page";

export const dynamic = "force-dynamic";

const DEFAULT_CAFE: CafeInfo = { name: "My Café", logo: "☕", tagline: "", currency: "USD" };
const isImg = (s: string) => /^https?:|^\/uploads\//.test(s || "");

async function load(id: string) {
  // Canonical site origin (custom domain if set)
  const origin = await siteOrigin();
  return withTenant(() => {
  const menu = getMenu();
  const item = menu.items.find((i) => i.id === id);
  const cafe = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
  return { item, cafe, origin, category: menu.categories.find((c) => c.id === item?.category) };
  }, { active: true });
}

/** Link preview for WhatsApp/Telegram/Instagram: product photo, name and price */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(decodeURIComponent(id)).catch(() => null);
  if (!loaded) return {};
  const { item, cafe, origin } = loaded;
  if (!item) return { title: cafe.name };
  const price = formatMoney(item.price, cafe.currency);
  const title = `${item.name} — ${cafe.name} menu`;
  const description = item.desc ? `${item.desc} · ${price}` : `${item.name} for ${price} on the ${cafe.name} menu.`;
  const og = (src: string) => (/^\/uploads\//.test(src) ? `${origin}${src}?w=1080&f=jpg` : src);
  // No product photo or logo: fall back to the venue's generated image (/og.png) so previews aren't empty
  const image = item.image ? og(item.image) : isImg(cafe.logo) ? og(cafe.logo) : `${origin}/og.png`;
  return {
    // Absolute title (skip the layout's "| Venue name" template)
    title: { absolute: title },
    description,
    alternates: { canonical: `/p/${encodeURIComponent(decodeURIComponent(id))}` },
    openGraph: { title, description, url: `${origin}/p/${id}`, siteName: cafe.name, type: "website", locale: "en_US", ...(image ? { images: [{ url: image, width: 1080, height: 1080, alt: item.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return tenantPage(async () => {
  const { item, cafe, origin, category } = await load(decodeURIComponent(id));
  if (!item) notFound();
  const money = (n: number) => formatMoney(n, cafe.currency);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { ...menuItemLd(origin, cafe, item), "@id": `${origin}/p/${encodeURIComponent(item.id)}#item` },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: `${cafe.name} menu`, item: `${origin}/` },
          ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${origin}/` }] : []),
          { "@type": "ListItem", position: category ? 3 : 2, name: item.name, item: `${origin}/p/${encodeURIComponent(item.id)}` },
        ],
      },
    ],
  };
  const onSale = !!item.oldPrice && item.oldPrice > item.price;
  const insta = cafe.instagram
    ? /^https?:/.test(cafe.instagram) ? cafe.instagram : `https://instagram.com/${cafe.instagram.replace(/^@/, "")}`
    : "";
  const shareText = [
    `${item.name} — ${money(item.price)}`,
    `☕ ${cafe.name}`,
    cafe.address && `📍 ${cafe.address}`,
    cafe.mapUrl && `🗺️ ${cafe.mapUrl}`,
    cafe.instagram && `📷 ${cafe.instagram}`,
  ].filter(Boolean).join("\n");

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-5">
      <JsonLd data={ld} />
      <header className="mb-4 flex items-center gap-2.5">
        <span className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-muted text-2xl">
          {isImg(cafe.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(cafe.logo, 160)} alt="" className="size-full object-cover" />
          ) : cafe.logo || "☕"}
        </span>
        <div className="leading-tight">
          <b className="block">{cafe.name}</b>
          {cafe.tagline && <span className="text-xs text-muted-foreground">{cafe.tagline}</span>}
        </div>
      </header>

      <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        <div className="relative grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_35%,#f3d9b8,#d39a68_50%,#7b4a2b)]">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(item.image, 1080)} alt={item.name} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="text-[8rem] drop-shadow-xl">{item.emoji || "☕"}</span>
          )}
          {item.image && <span className="pointer-events-none absolute inset-0 grid -rotate-[20deg] place-items-center text-2xl font-black text-white/15">{cafe.name}</span>}
          {item.tag && <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">{item.tag}</span>}
        </div>
        <div className="p-5">
          {category && <p className="mb-1 text-xs text-muted-foreground">{category.name}</p>}
          <h1 className="text-2xl font-black">{item.name}</h1>
          {item.desc && <p className="mt-2 leading-7 text-muted-foreground">{item.desc}</p>}
          <div className="mt-4 text-xl font-black text-primary">
            {onSale && <s className="me-2 text-base font-medium text-muted-foreground">{money(item.oldPrice!)}</s>}
            {money(item.price)}
          </div>
          {!item.available && <p className="mt-2 text-sm text-muted-foreground">Currently unavailable</p>}
        </div>
      </article>

      {(cafe.address || cafe.mapUrl || insta) && (
        <div className="mt-4 space-y-2 rounded-3xl border border-border bg-card p-4 text-sm">
          {cafe.address && <p>📍 {cafe.address}</p>}
          {(cafe.mapUrl || insta) && <div className="flex flex-wrap gap-2">
            {cafe.mapUrl && <a href={cafe.mapUrl} target="_blank" rel="noopener" className="rounded-full border border-border px-4 py-2 font-semibold transition hover:bg-muted">🗺️ Get directions</a>}
            {insta && <a href={insta} target="_blank" rel="noopener" className="rounded-full border border-border px-4 py-2 font-semibold transition hover:bg-muted">📷 Instagram</a>}
          </div>}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Link href="/" className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20">View menu</Link>
        <ProductShare target={{ title: item.name, text: shareText, url: `${origin}/p/${encodeURIComponent(item.id)}`, image: item.image ? thumb(item.image, 1080) : undefined }} />
      </div>
    </main>
  );
  }, { active: true });
}
