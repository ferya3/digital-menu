import { saasEnabled, rootDomain } from "@/lib/tenant-context";
import { requestProto } from "@/lib/tenant";
import { siteContent } from "@/lib/platform-admin";

/**
 * لینکِ کوچکِ پایینِ منوی مجموعه‌ها به سایتِ پلتفرم («منوی دیجیتال با …»).
 * هم مشتری‌های تازه را به سایت می‌آورد و هم برای سئوی سایتِ پلتفرم بک‌لینک می‌سازد.
 * از پنلِ مدیرِ کل ← محتوای سایت ← برند و سئو خاموش می‌شود.
 */
export async function PoweredBy() {
  if (!saasEnabled() || !rootDomain()) return null;
  const c = siteContent();
  if (c.brand.poweredBy === false) return null;
  const href = `${await requestProto()}://${rootDomain()}/`;
  return (
    <p className="pb-8 pt-2 text-center text-[11px] text-muted-foreground">
      <a href={href} className="hover:text-foreground hover:underline">منوی دیجیتال با {c.brand.name}</a>
    </p>
  );
}
