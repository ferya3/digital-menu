import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

/**
 * چندمستاجری: هر مجموعه (کافه/رستوران/…) پوشهٔ جدای خودش را دارد
 *   data/tenants/<slug>/cafe.db  +  data/tenants/<slug>/uploads/
 * مستاجرِ هر درخواست با AsyncLocalStorage به db()/آپلودها/رویدادهای زنده می‌رسد.
 * بدونِ ROOT_DOMAIN برنامه مثل قبل تک‌مجموعه‌ای است (داده مستقیم در data/).
 */
export const DATA_DIR = path.join(process.cwd(), "data");
export const DEFAULT_SLUG = "default";

export interface TenantCtx {
  slug: string;
  dir: string;
}

const g = globalThis as unknown as { __tenantAls?: AsyncLocalStorage<TenantCtx> };
const als = (g.__tenantAls ??= new AsyncLocalStorage<TenantCtx>());

/** دامنهٔ اصلیِ پلتفرم (مثلاً artavilstar.com)؛ خالی = حالتِ تک‌مجموعه‌ای */
export function rootDomain(): string {
  return (process.env.ROOT_DOMAIN || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/.]+$/, "");
}
export const saasEnabled = () => !!rootDomain();

export function tenantDir(slug: string): string {
  return slug === DEFAULT_SLUG ? DATA_DIR : path.join(DATA_DIR, "tenants", slug);
}

export function runAsTenant<T>(slug: string, fn: () => T): T {
  return als.run({ slug, dir: tenantDir(slug) }, fn);
}

export function currentTenant(): TenantCtx {
  const t = als.getStore();
  if (t) return t;
  if (!saasEnabled()) return { slug: DEFAULT_SLUG, dir: DATA_DIR };
  // در حالتِ چندمستاجری هر دسترسی به داده باید داخلِ withTenant باشد (جلوگیری از نشتِ دادهٔ مجموعه‌ها)
  throw new Error("tenant context missing");
}
export const tenantOrNull = (): TenantCtx | null => als.getStore() ?? (saasEnabled() ? null : { slug: DEFAULT_SLUG, dir: DATA_DIR });
