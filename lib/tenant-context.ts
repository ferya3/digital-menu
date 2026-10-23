import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

/**
 * Multi-tenancy: each venue (café/restaurant/…) has its own folder
 *   data/tenants/<slug>/cafe.db  +  data/tenants/<slug>/uploads/
 * The request's tenant reaches db()/uploads/live events through AsyncLocalStorage.
 * Without ROOT_DOMAIN the app runs as a single venue (data directly in data/).
 */
export const DATA_DIR = path.join(process.cwd(), "data");
export const DEFAULT_SLUG = "default";

export interface TenantCtx {
  slug: string;
  dir: string;
}

const g = globalThis as unknown as { __tenantAls?: AsyncLocalStorage<TenantCtx> };
const als = (g.__tenantAls ??= new AsyncLocalStorage<TenantCtx>());

/** The platform's root domain (e.g. example.com); empty = single-venue mode */
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
  // In multi-tenant mode every data access must happen inside withTenant (prevents cross-venue data leaks)
  throw new Error("tenant context missing");
}
export const tenantOrNull = (): TenantCtx | null => als.getStore() ?? (saasEnabled() ? null : { slug: DEFAULT_SLUG, dir: DATA_DIR });
