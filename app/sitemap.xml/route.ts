import { saasEnabled } from "@/lib/tenant-context";
import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { siteOrigin, tenantIndexable } from "@/lib/seo";
import { getMenu } from "@/lib/queries";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function xml(urls: { loc: string; priority: string; freq: string }[]) {
  const now = new Date().toISOString().slice(0, 10);
  const body = urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${now}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.priority}</priority></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

/** نقشهٔ سایت: صفحه‌های پلتفرم، یا منو + صفحهٔ هر محصولِ مجموعه */
export async function GET() {
  const origin = await siteOrigin();
  if (saasEnabled()) {
    const kind = classifyHost((await requestHost()).host).kind;
    if (kind === "platform") {
      return xml([
        { loc: `${origin}/`, priority: "1.0", freq: "weekly" },
        { loc: `${origin}/signup`, priority: "0.8", freq: "monthly" },
        { loc: `${origin}/terms`, priority: "0.3", freq: "yearly" },
        { loc: `${origin}/privacy`, priority: "0.3", freq: "yearly" },
      ]);
    }
    if (kind === "missing") return new Response("Not found", { status: 404 });
  }
  try {
    return await withTenant(() => {
      if (!tenantIndexable()) return new Response("Not found", { status: 404 });
      const menu = getMenu();
      return xml([
        { loc: `${origin}/`, priority: "1.0", freq: "daily" },
        ...menu.items.filter((i) => i.available).map((i) => ({ loc: `${origin}/p/${encodeURIComponent(i.id)}`, priority: "0.7", freq: "weekly" })),
      ]);
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
