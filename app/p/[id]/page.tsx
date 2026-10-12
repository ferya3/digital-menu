import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenu, getSetting } from "@/lib/queries";
import { formatMoney, thumb } from "@/lib/utils";
import type { CafeInfo } from "@/lib/types";
import { ProductShare } from "./share";

export const dynamic = "force-dynamic";

const DEFAULT_CAFE: CafeInfo = { name: "کافه", logo: "☕", tagline: "", currency: "toman" };
const isImg = (s: string) => /^https?:|^\/uploads\//.test(s || "");

async function load(id: string) {
  const menu = getMenu();
  const item = menu.items.find((i) => i.id === id);
  const cafe = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("x-forwarded-host") || h.get("host")}`;
  return { item, cafe, origin, category: menu.categories.find((c) => c.id === item?.category) };
}

/** پیش‌نمایشِ لینک در واتساپ/تلگرام/اینستاگرام: عکس، نام و قیمت محصول */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { item, cafe, origin } = await load(decodeURIComponent(id));
  if (!item) return { title: cafe.name };
  const price = formatMoney(item.price, cafe.currency);
  const title = `${item.name} — ${price} | ${cafe.name}`;
  const description = item.desc || cafe.tagline || `منوی ${cafe.name}`;
  const og = (src: string) => (/^\/uploads\//.test(src) ? `${origin}${src}?w=1080&f=jpg` : src);
  const image = item.image ? og(item.image) : isImg(cafe.logo) ? og(cafe.logo) : undefined;
  return {
    title,
    description,
    openGraph: { title, description, url: `${origin}/p/${id}`, siteName: cafe.name, type: "website", ...(image ? { images: [{ url: image, width: 1080, height: 1080, alt: item.name }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, cafe, origin, category } = await load(decodeURIComponent(id));
  if (!item) notFound();
  const money = (n: number) => formatMoney(n, cafe.currency);
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
          {item.tag && <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow">{item.tag}</span>}
        </div>
        <div className="p-5">
          {category && <p className="mb-1 text-xs text-muted-foreground">{category.name}</p>}
          <h1 className="text-2xl font-black">{item.name}</h1>
          {item.desc && <p className="mt-2 leading-7 text-muted-foreground">{item.desc}</p>}
          <div className="mt-4 text-xl font-black text-primary">
            {onSale && <s className="me-2 text-base font-medium text-muted-foreground">{money(item.oldPrice!)}</s>}
            {money(item.price)}
          </div>
          {!item.available && <p className="mt-2 text-sm text-muted-foreground">فعلاً ناموجود</p>}
        </div>
      </article>

      {(cafe.address || cafe.mapUrl || insta) && (
        <div className="mt-4 space-y-2 rounded-3xl border border-border bg-card p-4 text-sm">
          {cafe.address && <p>📍 {cafe.address}</p>}
          {(cafe.mapUrl || insta) && <div className="flex flex-wrap gap-2">
            {cafe.mapUrl && <a href={cafe.mapUrl} target="_blank" rel="noopener" className="rounded-full border border-border px-4 py-2 font-semibold transition hover:bg-muted">🗺️ مسیریابی روی نقشه</a>}
            {insta && <a href={insta} target="_blank" rel="noopener" className="rounded-full border border-border px-4 py-2 font-semibold transition hover:bg-muted">📷 اینستاگرام</a>}
          </div>}
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <Link href="/" className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20">مشاهدهٔ منو</Link>
        <ProductShare target={{ title: item.name, text: shareText, url: `${origin}/p/${encodeURIComponent(item.id)}`, image: item.image ? thumb(item.image, 1080) : undefined }} />
      </div>
    </main>
  );
}
