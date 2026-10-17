import "server-only";
import type { ReactNode } from "react";
import { TenantUnavailableError, withTenant } from "@/lib/tenant";
import { TenantUnavailable } from "@/components/tenant-unavailable";
import { siteContent } from "@/lib/platform-admin";

/** صفحهٔ سروری در زمینهٔ مجموعه؛ اگر مجموعه نبود/غیرفعال بود صفحهٔ مناسب نشان داده می‌شود */
export async function tenantPage(fn: () => Promise<ReactNode> | ReactNode, opts: { active?: boolean } = {}): Promise<ReactNode> {
  try {
    return await withTenant(fn, opts);
  } catch (e) {
    if (e instanceof TenantUnavailableError) {
      let texts;
      try { texts = siteContent().unavailable; } catch { /* پلتفرم در دسترس نیست → متنِ پیش‌فرض */ }
      return <TenantUnavailable reason={e.reason} name={e.tenant?.name} texts={texts} />;
    }
    throw e;
  }
}
