import "server-only";
import type { ReactNode } from "react";
import { TenantUnavailableError, withTenant } from "@/lib/tenant";
import { TenantUnavailable } from "@/components/tenant-unavailable";
import { siteContent } from "@/lib/platform-admin";

/** Server page in the venue's context; shows a suitable page if the venue is missing/inactive */
export async function tenantPage(fn: () => Promise<ReactNode> | ReactNode, opts: { active?: boolean } = {}): Promise<ReactNode> {
  try {
    return await withTenant(fn, opts);
  } catch (e) {
    if (e instanceof TenantUnavailableError) {
      let texts;
      try { texts = siteContent().unavailable; } catch { /* platform unavailable → default text */ }
      return <TenantUnavailable reason={e.reason} name={e.tenant?.name} texts={texts} />;
    }
    throw e;
  }
}
