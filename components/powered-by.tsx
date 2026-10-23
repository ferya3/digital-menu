import { saasEnabled, rootDomain } from "@/lib/tenant-context";
import { requestProto } from "@/lib/tenant";
import { siteContent } from "@/lib/platform-admin";

/**
 * Small link at the bottom of each venue menu to the platform site ("Digital menu by …").
 * Brings in new customers and builds backlinks for the platform site's SEO.
 * Can be turned off in Platform admin → Site content → Brand & SEO.
 */
export async function PoweredBy() {
  if (!saasEnabled() || !rootDomain()) return null;
  const c = siteContent();
  if (c.brand.poweredBy === false) return null;
  const href = `${await requestProto()}://${rootDomain()}/`;
  return (
    <p className="pb-8 pt-2 text-center text-[11px] text-muted-foreground">
      <a href={href} className="hover:text-foreground hover:underline">Digital menu by {c.brand.name}</a>
    </p>
  );
}
