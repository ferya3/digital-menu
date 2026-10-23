import { saasEnabled } from "@/lib/tenant-context";
import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { siteOrigin, tenantIndexable } from "@/lib/seo";

export const dynamic = "force-dynamic";

const txt = (body: string) => new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });

/** Separate robots.txt for the platform site and each venue (dashboards and internal pages are not indexed) */
export async function GET() {
  const origin = await siteOrigin();
  if (saasEnabled()) {
    const kind = classifyHost((await requestHost()).host).kind;
    if (kind === "platform") return txt(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /login\nDisallow: /partner/\nDisallow: /r/\n\nSitemap: ${origin}/sitemap.xml\n`);
    if (kind === "missing") return txt("User-agent: *\nDisallow: /\n");
  }
  try {
    const ok = await withTenant(() => tenantIndexable());
    if (!ok) return txt("User-agent: *\nDisallow: /\n");
  } catch {
    return txt("User-agent: *\nDisallow: /\n");
  }
  return txt(`User-agent: *\nAllow: /\nDisallow: /staff\nDisallow: /print\nDisallow: /live\nDisallow: /billing\nDisallow: /qr\n\nSitemap: ${origin}/sitemap.xml\n`);
}
