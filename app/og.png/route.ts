import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { saasEnabled } from "@/lib/tenant-context";
import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { uploadsDir } from "@/lib/images";
import { ASSETS_DIR, siteContent } from "@/lib/platform-admin";
import { BRAND_COLORS } from "@/lib/site-content";
import { cafeInfo } from "@/lib/seo";

export const dynamic = "force-dynamic";

const cache = new Map<string, Buffer>();

/** فایلِ لوگو روی دیسک (فقط مسیرهای خودِ سایت) */
function logoFile(src: string): string | null {
  const name = path.basename(src || "");
  if (src.startsWith("/brand/")) return path.join(ASSETS_DIR, name);
  if (src.startsWith("/uploads/")) return path.join(uploadsDir(), name);
  return null;
}

/**
 * تصویرِ پیش‌نمایشِ لینک (۱۲۰۰×۶۳۰) برای واتساپ/تلگرام/گوگل: رنگِ برند + لوگو.
 * بدونِ متن (فونتِ فارسی برای رسم در سرور لازم نیست) و یک‌بار ساخته و در حافظه نگه داشته می‌شود.
 */
async function render(hex: string, logo: string | null): Promise<Buffer> {
  const key = `${hex}|${logo || ""}|${logo && fs.existsSync(logo) ? fs.statSync(logo).mtimeMs : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1020"/><stop offset="1" stop-color="#020617"/></linearGradient>
      <radialGradient id="r" cx="0.5" cy="0.35" r="0.6"><stop offset="0" stop-color="${hex}" stop-opacity="0.55"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient>
      <pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity="0.06"/></pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#p)"/><rect width="1200" height="630" fill="url(#r)"/>
    <rect x="460" y="175" width="280" height="280" rx="64" fill="${hex}"/>
  </svg>`);
  const layers: sharp.OverlayOptions[] = [];
  if (logo && fs.existsSync(logo)) {
    const mask = Buffer.from(`<svg width="280" height="280"><rect width="280" height="280" rx="64" fill="#fff"/></svg>`);
    const img = await sharp(logo).resize(280, 280, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: img, left: 460, top: 175 });
  } else {
    // نمادِ QR ساده روی کادرِ رنگی
    layers.push({ input: Buffer.from(`<svg width="280" height="280"><g fill="#fff" transform="translate(70 70)">
      <rect width="56" height="56" rx="10"/><rect x="84" width="56" height="56" rx="10"/><rect y="84" width="56" height="56" rx="10"/>
      <rect x="84" y="84" width="22" height="22" rx="4"/><rect x="118" y="118" width="22" height="22" rx="4"/><rect x="84" y="118" width="22" height="22" rx="4"/></g></svg>`), left: 460, top: 175 });
  }
  const out = await sharp(bg).composite(layers).png({ compressionLevel: 9 }).toBuffer();
  cache.set(key, out);
  return out;
}

export async function GET() {
  let hex = "#d4212f", logo: string | null = null;
  try {
    if (saasEnabled() && classifyHost((await requestHost()).host).kind === "platform") {
      const c = siteContent();
      hex = (BRAND_COLORS.find((x) => x.id === c.brand.color) || BRAND_COLORS[0]).hex;
      logo = logoFile(c.brand.logo);
    } else {
      logo = await withTenant(() => logoFile(cafeInfo().logo));
    }
  } catch { /* مجموعهٔ ناموجود: تصویرِ پیش‌فرض */ }
  const png = await render(hex, logo);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
