import "server-only";
import { headers } from "next/headers";
import { DEFAULT_SLUG, rootDomain, runAsTenant, saasEnabled, currentTenant } from "@/lib/tenant-context";
import { getTenant, tenantByDomain, tenantState, touchTenant, type Tenant } from "@/lib/platform";

/** Request host (without port). Only the Host header — which Nginx sets itself — is trusted. */
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
    super(reason === "missing" ? "This address isn't connected to any menu" : "This venue's subscription isn't active, so the menu is temporarily unavailable");
  }
}

/** The current request's venue; null in single-venue mode */
export async function resolveTenant(): Promise<Tenant | null> {
  if (!saasEnabled()) return null;
  const info = classifyHost((await requestHost()).host);
  if (info.kind !== "tenant") throw new TenantUnavailableError("missing");
  return info.tenant;
}

/**
 * Runs code in the context of the current request's venue (db, uploads, live events, etc. all target that venue).
 * active: for customer-facing parts — throws if the subscription has expired or is suspended.
 */
export async function withTenant<T>(fn: () => Promise<T> | T, opts: { active?: boolean } = {}): Promise<T> {
  const t = await resolveTenant();
  if (!t) return runAsTenant(DEFAULT_SLUG, fn);
  if (opts.active && !tenantState(t).active) throw new TenantUnavailableError("inactive", t);
  touchTenant(t.slug);
  return runAsTenant(t.slug, fn);
}

/** Current venue record (inside withTenant) */
export function currentTenantRecord(): Tenant | null {
  if (!saasEnabled()) return null;
  return getTenant(currentTenant().slug);
}

/** URL of a venue's panel/menu using the current request's protocol and port */
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

/** Route handler in the venue's context; missing/inactive venue = 404 */
export async function tenantRoute(fn: () => Promise<Response> | Response, opts: { active?: boolean } = {}): Promise<Response> {
  try {
    return await withTenant(fn, opts);
  } catch (e) {
    if (e instanceof TenantUnavailableError) return new Response(e.message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    throw e;
  }
}

/** Is this request on the platform's root domain (landing/signup/super admin)? */
export async function onPlatformHost(): Promise<boolean> {
  return saasEnabled() && classifyHost((await requestHost()).host).kind === "platform";
}
