import "server-only";
import { headers } from "next/headers";
import { DEFAULT_SLUG, rootDomain, runAsTenant, saasEnabled, currentTenant } from "@/lib/tenant-context";
import { getTenant, tenantByDomain, tenantState, touchTenant, type Tenant } from "@/lib/platform";

/** میزبانِ درخواست (بدونِ پورت). فقط سرآیندِ Host — که Nginx خودش می‌گذارد — معتبر است. */
export async function requestHost(): Promise<{ host: string; port: string }> {
  const raw = ((await headers()).get("host") || "").toLowerCase();
  const m = raw.match(/^(.*?)(:\d+)?$/);
  return { host: m?.[1] || "", port: m?.[2] || "" };
}
export async function requestProto(): Promise<"http" | "https"> {
  return (await headers()).get("x-forwarded-proto") === "https" ? "https" : "http";
}

export type HostInfo = { kind: "platform" } | { kind: "tenant"; tenant: Tenant } | { kind: "missing" };
export function classifyHost(host: string): HostInfo {
  const root = rootDomain();
  if (host === root || host === `www.${root}`) return { kind: "platform" };
  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    if (!slug.includes(".")) {
      const t = getTenant(slug);
      return t ? { kind: "tenant", tenant: t } : { kind: "missing" };
    }
  }
  const t = tenantByDomain(host);
  return t ? { kind: "tenant", tenant: t } : { kind: "missing" };
}

export class TenantUnavailableError extends Error {
  constructor(public reason: "missing" | "inactive", public tenant?: Tenant) {
    super(reason === "missing" ? "این آدرس به هیچ منویی وصل نیست" : "اشتراکِ این مجموعه فعال نیست؛ منو موقتاً در دسترس نیست");
  }
}

/** مجموعهٔ همین درخواست؛ در حالتِ تک‌مجموعه‌ای null */
export async function resolveTenant(): Promise<Tenant | null> {
  if (!saasEnabled()) return null;
  const info = classifyHost((await requestHost()).host);
  if (info.kind !== "tenant") throw new TenantUnavailableError("missing");
  return info.tenant;
}

/**
 * اجرای کد در زمینهٔ مجموعهٔ همین درخواست (db، آپلودها، رویدادهای زنده و … همه به همان مجموعه می‌روند).
 * active: برای بخش‌های مشتری — اگر اشتراک تمام/تعلیق شده باشد خطا می‌دهد.
 */
export async function withTenant<T>(fn: () => Promise<T> | T, opts: { active?: boolean } = {}): Promise<T> {
  const t = await resolveTenant();
  if (!t) return runAsTenant(DEFAULT_SLUG, fn);
  if (opts.active && !tenantState(t).active) throw new TenantUnavailableError("inactive", t);
  touchTenant(t.slug);
  return runAsTenant(t.slug, fn);
}

/** رکوردِ مجموعهٔ جاری (داخلِ withTenant) */
export function currentTenantRecord(): Tenant | null {
  if (!saasEnabled()) return null;
  return getTenant(currentTenant().slug);
}

/** آدرسِ پنل/منوی یک مجموعه با همان پروتکل و پورتِ درخواستِ فعلی */
export async function tenantUrl(t: Pick<Tenant, "slug" | "domain">, pathname = "/"): Promise<string> {
  const proto = await requestProto();
  const { port } = await requestHost();
  return `${proto}://${t.domain || `${t.slug}.${rootDomain()}`}${port}${pathname}`;
}
export async function platformUrl(pathname = "/"): Promise<string> {
  const proto = await requestProto();
  const { port } = await requestHost();
  return `${proto}://${rootDomain()}${port}${pathname}`;
}

/** route handler در زمینهٔ مجموعه؛ مجموعهٔ ناموجود/غیرفعال = ۴۰۴ */
export async function tenantRoute(fn: () => Promise<Response> | Response, opts: { active?: boolean } = {}): Promise<Response> {
  try {
    return await withTenant(fn, opts);
  } catch (e) {
    if (e instanceof TenantUnavailableError) return new Response(e.message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    throw e;
  }
}
