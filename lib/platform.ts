import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR, rootDomain, runAsTenant, tenantDir } from "@/lib/tenant-context";
import { closeTenantDb, initTenantDb } from "@/lib/db";
import { hashPassword, isWeakPassword, verifyPassword } from "@/lib/auth";
import { setSetting } from "@/lib/queries";
import { sendSmsWith } from "@/lib/sms-send";
import { DEFAULT_SMS } from "@/lib/otp";
import type { BusinessKind } from "@/lib/seeds";
import type { SmsSettings } from "@/lib/types";
import { SECRET_SETTINGS, seal, sealExisting, unseal } from "@/lib/secret-box";

/**
 * The platform's own database (data/platform.db): venues, subscriptions, payments and platform settings.
 * Each venue's data (menu, orders, customers…) lives separately in data/tenants/<slug>/.
 */
const DAY = 86_400_000;
const g = globalThis as unknown as { __platformDb?: DatabaseSync };

export function pdb(): DatabaseSync {
  if (g.__platformDb) return g.__platformDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const d = new DatabaseSync(path.join(DATA_DIR, "platform.db"));
  d.exec("PRAGMA journal_mode = WAL;");
  d.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      slug TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT DEFAULT 'cafe',
      owner_name TEXT DEFAULT '', owner_phone TEXT DEFAULT '',
      status TEXT DEFAULT 'active', plan TEXT DEFAULT 'trial', expires_at TEXT,
      domain TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT, last_seen TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL, plan TEXT, months INTEGER, amount INTEGER,
      method TEXT, status TEXT DEFAULT 'pending', authority TEXT DEFAULT '', ref_id TEXT DEFAULT '',
      receipt TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT, paid_at TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE INDEX IF NOT EXISTS idx_pay_slug ON payments(slug);
    CREATE INDEX IF NOT EXISTS idx_pay_auth ON payments(authority);
    -- Activity log (super admin actions, signups, payments)
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, actor TEXT, action TEXT, target TEXT DEFAULT '', detail TEXT DEFAULT '', ip TEXT DEFAULT '');
    CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);
    -- Subscription coupons
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY, kind TEXT DEFAULT 'percent', value INTEGER, max_uses INTEGER DEFAULT 0, used INTEGER DEFAULT 0,
      expires_at TEXT DEFAULT '', plans TEXT DEFAULT '', active INTEGER DEFAULT 1, note TEXT DEFAULT '', created_at TEXT
    );
    -- Sent SMS reminders (each reminder only once per subscription period)
    CREATE TABLE IF NOT EXISTS reminders (key TEXT PRIMARY KEY, slug TEXT, kind TEXT, at TEXT, status TEXT, detail TEXT DEFAULT '');
    -- Bulk SMS to venue owners
    CREATE TABLE IF NOT EXISTS owner_sms (id TEXT PRIMARY KEY, at TEXT, message TEXT, audience TEXT, total INTEGER, sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, status TEXT DEFAULT 'running');
  `);
  for (const sql of ["ALTER TABLE tenants ADD COLUMN ref TEXT DEFAULT ''", "ALTER TABLE payments ADD COLUMN coupon TEXT DEFAULT ''", "ALTER TABLE payments ADD COLUMN discount INTEGER DEFAULT 0", "ALTER TABLE payments ADD COLUMN list_price INTEGER DEFAULT 0"]) {
    try { d.exec(sql); } catch { /* column already exists */ }
  }
  g.__platformDb = d;
  sealExisting(d);
  migrateLegacy(d);
  return d;
}

/* ----------------------------- Settings ----------------------------- */
export interface Plan {
  id: string;
  title: string;
  months: number;
  /** In the platform currency (decimal) */
  price: number;
  popular?: boolean;
}
export interface PlatformSettings {
  brand: string;
  tagline: string;
  support: string;
  trialDays: number;
  allowSignup: boolean;
  plans: Plan[];
  /** ISO 4217 currency for plans and payments, e.g. "USD" */
  currency: string;
  /** Stripe account for subscription payments (empty = online payment disabled) */
  stripe: { secretKey: string };
  /** Bank transfer details for manual subscription payments (empty number = disabled). Payment method key: "card". */
  card: { number: string; holder: string; bank: string };
  /** Platform SMS (Twilio): signup verification codes and renewal reminders */
  sms: SmsSettings;
}
export const DEFAULT_PLATFORM: PlatformSettings = {
  brand: "MenuPilot",
  tagline: "QR menus, table ordering and a management panel for cafés, restaurants and fast food",
  support: "",
  trialDays: 14,
  allowSignup: true,
  plans: [
    { id: "m1", title: "Monthly", months: 1, price: 19 },
    { id: "m3", title: "Quarterly", months: 3, price: 49, popular: true },
    { id: "m12", title: "Yearly", months: 12, price: 179 },
  ],
  currency: "USD",
  stripe: { secretKey: "" },
  card: { number: "", holder: "", bank: "" },
  sms: { ...DEFAULT_SMS },
};

export function rawGet<T>(key: string, fallback: T): T {
  const r = pdb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as unknown as { value: string } | undefined;
  if (!r) return fallback;
  try { return JSON.parse(unseal(r.value)) as T; } catch { return fallback; }
}
export function rawSet(key: string, value: unknown) {
  const json = JSON.stringify(value);
  pdb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, SECRET_SETTINGS.has(key) ? seal(json) : json);
}
export function platformSettings(): PlatformSettings {
  const s = rawGet<Partial<PlatformSettings>>("platform", {});
  return {
    ...DEFAULT_PLATFORM, ...s,
    currency: /^[A-Z]{3}$/.test(s.currency || "") ? s.currency! : DEFAULT_PLATFORM.currency,
    stripe: { ...DEFAULT_PLATFORM.stripe, ...s.stripe },
    card: { ...DEFAULT_PLATFORM.card, ...s.card },
    sms: { ...DEFAULT_PLATFORM.sms, ...s.sms },
    plans: s.plans?.length ? s.plans : DEFAULT_PLATFORM.plans,
  };
}
export function savePlatformSettings(next: PlatformSettings) {
  const plans = next.plans
    .map((p, i) => ({ id: p.id || `p${i + 1}`, title: String(p.title || "").trim().slice(0, 40), months: Math.max(1, Math.min(36, Math.round(Number(p.months) || 1))), price: Math.max(0, Math.round((Number(p.price) || 0) * 100) / 100), popular: !!p.popular }))
    .filter((p) => p.title);
  if (!plans.length) throw new Error("At least one subscription plan is required");
  const currency = String(next.currency || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a 3-letter ISO code, e.g. USD");
  rawSet("platform", { ...next, currency, trialDays: Math.max(0, Math.min(90, Math.round(Number(next.trialDays) || 0))), plans });
}
/** Platform signing secret and super admin password */
function platformSecret(): string {
  let s = rawGet<string>("secret", "");
  if (!s) { s = crypto.randomBytes(32).toString("hex"); rawSet("secret", s); }
  return s;
}
export function checkPlatformAdmin(pw: string): boolean {
  const stored = rawGet<string>("admin_pw", "");
  if (stored) return verifyPassword(pw, stored);
  const env = process.env.PLATFORM_ADMIN_PASSWORD || "";
  if (!env) return false;
  const a = crypto.createHash("sha256").update(pw).digest(), b = crypto.createHash("sha256").update(env).digest();
  return crypto.timingSafeEqual(a, b);
}
export const platformAdminConfigured = () => !!(rawGet<string>("admin_pw", "") || process.env.PLATFORM_ADMIN_PASSWORD);
export function setPlatformAdminPassword(pw: string) {
  if (pw.length < 8) throw new Error("The password must be at least 8 characters");
  rawSet("admin_pw", hashPassword(pw));
}

/** Token signed with the platform key (auto-login to a venue's panel, super admin session) */
export function signPlatform(data: Record<string, unknown>, ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlMs, n: crypto.randomBytes(16).toString("hex") })).toString("base64url");
  const sig = crypto.createHmac("sha256", platformSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyPlatform<T>(token: string | undefined | null): (T & { n: string }) | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", platformSecret()).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number; n: string };
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

/* ----------------------------- Venues ----------------------------- */
export interface Tenant {
  slug: string; name: string; kind: BusinessKind; ownerName: string; ownerPhone: string;
  status: "active" | "suspended"; plan: string; expiresAt: string; domain: string;
  note: string; createdAt: string; lastSeen: string;
  /** Referring partner code (empty = no referrer) */
  ref: string;
}
type Row = { slug: string; name: string; kind: string; owner_name: string; owner_phone: string; status: string; plan: string; expires_at: string; domain: string; note: string; created_at: string; last_seen: string; ref?: string };
const toTenant = (r: Row): Tenant => ({
  slug: r.slug, name: r.name, kind: (r.kind || "cafe") as BusinessKind, ownerName: r.owner_name, ownerPhone: r.owner_phone,
  status: r.status === "suspended" ? "suspended" : "active", plan: r.plan, expiresAt: r.expires_at, domain: r.domain || "",
  note: r.note || "", createdAt: r.created_at, lastSeen: r.last_seen || "", ref: r.ref || "",
});
export function getTenant(slug: string): Tenant | null {
  const r = pdb().prepare("SELECT * FROM tenants WHERE slug = ?").get(slug) as unknown as Row | undefined;
  return r ? toTenant(r) : null;
}
/** A venue's custom domain (e.g. menu.myrestaurant.com) */
export function tenantByDomain(host: string): Tenant | null {
  const h = host.replace(/^www\./, "");
  const r = pdb().prepare("SELECT * FROM tenants WHERE domain != '' AND domain = ?").get(h) as unknown as Row | undefined;
  return r ? toTenant(r) : null;
}
export function listTenants(): Tenant[] {
  return (pdb().prepare("SELECT * FROM tenants ORDER BY created_at DESC").all() as unknown as Row[]).map(toTenant);
}

export type TenantStateName = "trial" | "active" | "expired" | "suspended";
export function tenantState(t: Tenant): { state: TenantStateName; active: boolean; daysLeft: number } {
  const left = Math.ceil((+new Date(t.expiresAt) - Date.now()) / DAY);
  if (t.status === "suspended") return { state: "suspended", active: false, daysLeft: left };
  if (!(left > 0)) return { state: "expired", active: false, daysLeft: Math.min(0, left || 0) };
  return { state: t.plan === "trial" ? "trial" : "active", active: true, daysLeft: left };
}

/** Reserved subdomains that venues can't claim */
const RESERVED = new Set("www admin api app apps mail email smtp ftp ns ns1 ns2 cdn static assets platform panel staff dashboard billing pay signup login register help support blog docs test dev demo root status shop store menu account accounts portal secure server host".split(" "));
export function validateSlug(raw: string, allowReserved = false): string {
  const slug = String(raw || "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,29}$/.test(slug) || slug.endsWith("-") || slug.includes("--"))
    throw new Error("The address must be 3–30 lowercase letters, digits or hyphens and start with a letter (e.g. blue-bottle)");
  if (RESERVED.has(slug) && !allowReserved) throw new Error("This address is reserved. Please choose another one");
  return slug;
}
export function slugAvailable(slug: string): boolean {
  return !getTenant(slug) && !fs.existsSync(tenantDir(slug));
}

export interface NewTenant {
  slug: string; name: string; kind: BusinessKind; ownerName: string; ownerPhone: string;
  password: string; sample: boolean; days?: number; plan?: string; note?: string;
  /** Referring partner code */
  ref?: string;
  /** Reserved addresses (like demo) only for the platform's own venues */
  reserved?: boolean;
}
/** Creates a new venue: record + folder + database with sample menu + panel password */
export function createTenant(input: NewTenant): Tenant {
  const slug = validateSlug(input.slug, input.reserved);
  const name = String(input.name || "").trim().slice(0, 60);
  if (name.length < 2) throw new Error("Please enter the venue name");
  if (!slugAvailable(slug)) throw new Error("This address is already taken");
  if (isWeakPassword(String(input.password || ""))) throw new Error("The password must be at least 8 characters and not a simple password");
  const kind: BusinessKind = (["cafe", "restaurant", "fastfood", "other"] as const).includes(input.kind) ? input.kind : "cafe";
  const days = input.days ?? platformSettings().trialDays;
  const now = new Date();
  pdb().prepare(
    `INSERT INTO tenants (slug, name, kind, owner_name, owner_phone, status, plan, expires_at, note, created_at, ref)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  ).run(slug, name, kind, String(input.ownerName || "").trim().slice(0, 60), String(input.ownerPhone || ""), input.plan || "trial",
    new Date(now.getTime() + days * DAY).toISOString(), input.note || "", now.toISOString(), String(input.ref || "").slice(0, 30));
  try {
    runAsTenant(slug, () => {
      initTenantDb({ kind, name, sample: input.sample });
      setSetting("admin_pw", hashPassword(input.password));
    });
  } catch (e) {
    pdb().prepare("DELETE FROM tenants WHERE slug = ?").run(slug);
    closeTenantDb(slug);
    fs.rmSync(tenantDir(slug), { recursive: true, force: true });
    throw e;
  }
  return getTenant(slug)!;
}

export function updateTenant(slug: string, patch: Partial<Pick<Tenant, "name" | "ownerName" | "ownerPhone" | "status" | "domain" | "note" | "expiresAt" | "plan" | "kind">>) {
  const t = getTenant(slug);
  if (!t) throw new Error("Venue not found");
  if (patch.domain !== undefined) {
    const d = patch.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (d && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new Error("Invalid domain");
    const root = rootDomain();
    if (d && root && (d === root || d.endsWith("." + root))) throw new Error("Platform subdomains work automatically. Only enter a custom domain here");
    if (d && tenantByDomain(d) && tenantByDomain(d)!.slug !== slug) throw new Error("This domain is already registered to another venue");
    patch.domain = d;
  }
  const n = { ...t, ...patch };
  pdb().prepare(
    "UPDATE tenants SET name=?, owner_name=?, owner_phone=?, status=?, domain=?, note=?, expires_at=?, plan=?, kind=? WHERE slug=?"
  ).run(String(n.name).trim().slice(0, 60) || t.name, String(n.ownerName).slice(0, 60), n.ownerPhone, n.status, n.domain, String(n.note).slice(0, 500), n.expiresAt, n.plan,
    (["cafe", "restaurant", "fastfood", "other"] as const).includes(n.kind) ? n.kind : t.kind, slug);
  return getTenant(slug)!;
}

/** Extend: from the current expiry date (if still in the future) or from today */
export function extendTenant(slug: string, months: number, plan: string, extraDays = 0) {
  const t = getTenant(slug);
  if (!t) throw new Error("Venue not found");
  const base = new Date(Math.max(Date.now(), +new Date(t.expiresAt) || 0));
  base.setMonth(base.getMonth() + months);
  base.setTime(base.getTime() + extraDays * DAY);
  return updateTenant(slug, { expiresAt: base.toISOString(), plan, status: "active" });
}

/** Delete: the folder is moved to data/deleted (can be restored manually) */
export function deleteTenant(slug: string) {
  if (!getTenant(slug)) throw new Error("Venue not found");
  closeTenantDb(slug);
  const src = tenantDir(slug);
  if (fs.existsSync(src)) {
    const dst = path.join(DATA_DIR, "deleted", `${slug}-${Date.now()}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
  }
  pdb().prepare("DELETE FROM tenants WHERE slug = ?").run(slug);
}

const seenAt = new Map<string, number>();
/** Last activity (written at most once every 5 minutes) */
export function touchTenant(slug: string) {
  const last = seenAt.get(slug) || 0;
  if (Date.now() - last < 5 * 60_000) return;
  seenAt.set(slug, Date.now());
  pdb().prepare("UPDATE tenants SET last_seen = ? WHERE slug = ?").run(new Date().toISOString(), slug);
}

/** Lightweight per-venue stats for the super admin panel */
export function tenantStats(slug: string): { orders: number; items: number; customers: number; revenue30: number } {
  const file = path.join(tenantDir(slug), "cafe.db");
  if (!fs.existsSync(file)) return { orders: 0, items: 0, customers: 0, revenue30: 0 };
  try {
    const d = new DatabaseSync(file, { readOnly: true });
    const n = (sql: string, ...a: string[]) => Number((d.prepare(sql).get(...a) as unknown as { c: number }).c || 0);
    const since = new Date(Date.now() - 30 * DAY).toISOString();
    const out = {
      orders: n("SELECT COUNT(*) c FROM orders"),
      items: n("SELECT COUNT(*) c FROM items"),
      customers: n("SELECT COUNT(*) c FROM customers"),
      revenue30: n("SELECT COALESCE(SUM(total),0) c FROM orders WHERE paid = 1 AND status != 'cancelled' AND paid_at >= ?", since),
    };
    d.close();
    return out;
  } catch {
    return { orders: 0, items: 0, customers: 0, revenue30: 0 };
  }
}

/* ----------------------------- Payments ----------------------------- */
export interface Payment {
  id: string; slug: string; plan: string; months: number; amount: number;
  /** stripe = online card payment, card = bank transfer with receipt, manual = recorded by the admin */
  method: "stripe" | "card" | "manual"; status: "pending" | "paid" | "failed" | "rejected";
  authority: string; refId: string; receipt: string; note: string; createdAt: string; paidAt: string;
  coupon: string; discount: number;
}
type PRow = { id: string; slug: string; plan: string; months: number; amount: number; method: string; status: string; authority: string; ref_id: string; receipt: string; note: string; created_at: string; paid_at: string; coupon: string; discount: number };
const toPayment = (r: PRow): Payment => ({
  id: r.id, slug: r.slug, plan: r.plan, months: r.months, amount: r.amount, method: r.method as Payment["method"],
  status: r.status as Payment["status"], authority: r.authority, refId: r.ref_id, receipt: r.receipt, note: r.note,
  createdAt: r.created_at, paidAt: r.paid_at, coupon: r.coupon || "", discount: r.discount || 0,
});
export function createPayment(p: { slug: string; plan: Plan; method: Payment["method"]; receipt?: string; note?: string; amount?: number; coupon?: string; discount?: number }): Payment {
  const id = `pay_${crypto.randomBytes(12).toString("base64url")}`; // 96 bits
  pdb().prepare(
    "INSERT INTO payments (id, slug, plan, months, amount, method, status, receipt, note, created_at, coupon, discount, list_price) VALUES (?,?,?,?,?,?, 'pending', ?, ?, ?, ?, ?, ?)"
  ).run(id, p.slug, p.plan.id, p.plan.months, p.amount ?? p.plan.price, p.method, p.receipt || "", p.note || "", new Date().toISOString(),
    p.coupon || "", p.discount || 0, p.plan.price);
  return getPayment(id)!;
}
export function getPayment(id: string): Payment | null {
  const r = pdb().prepare("SELECT * FROM payments WHERE id = ?").get(id) as unknown as PRow | undefined;
  return r ? toPayment(r) : null;
}
export function paymentByAuthority(authority: string): Payment | null {
  const r = pdb().prepare("SELECT * FROM payments WHERE authority = ? AND authority != ''").get(authority) as unknown as PRow | undefined;
  return r ? toPayment(r) : null;
}
export function setPaymentAuthority(id: string, authority: string) {
  pdb().prepare("UPDATE payments SET authority = ? WHERE id = ?").run(authority, id);
}
export function listPayments(slug?: string, limit = 200): Payment[] {
  const rows = slug
    ? pdb().prepare("SELECT * FROM payments WHERE slug = ? ORDER BY created_at DESC LIMIT ?").all(slug, limit)
    : pdb().prepare("SELECT * FROM payments ORDER BY created_at DESC LIMIT ?").all(limit);
  return (rows as unknown as PRow[]).map(toPayment);
}
/** Confirms a payment + extends the subscription (only once; a repeated callback doesn't extend twice) */
export function markPaymentPaid(id: string, refId = "", note = ""): Payment {
  const d = pdb();
  const res = d.prepare("UPDATE payments SET status='paid', ref_id=?, paid_at=?, note=CASE WHEN ?!='' THEN ? ELSE note END WHERE id=? AND status IN ('pending','failed')")
    .run(refId, new Date().toISOString(), note, note, id);
  const p = getPayment(id);
  if (!p) throw new Error("Payment not found");
  if (Number(res.changes) > 0) {
    extendTenant(p.slug, p.months, p.plan);
    // Count coupon usage only once the payment actually succeeded
    if (p.coupon) d.prepare("UPDATE coupons SET used = used + 1 WHERE code = ?").run(p.coupon);
  }
  return p;
}
export function markPaymentFailed(id: string, status: "failed" | "rejected", note = "") {
  pdb().prepare("UPDATE payments SET status=?, note=? WHERE id=? AND status='pending'").run(status, note, id);
}

/* ----------------------------- Platform SMS ----------------------------- */
export function platformSmsReady() {
  const s = platformSettings().sms;
  return s.provider !== "none";
}
export async function sendPlatformSms(phone: string, text: string) {
  return sendSmsWith(platformSettings().sms, phone, text);
}

/* ----------------------------- Migration from single-venue mode ----------------------------- */
/**
 * LEGACY_DOMAIN=mycafe.com: the venue's previous domain is attached as that venue's custom domain
 * (printed QR codes keep working unchanged). Only when the venue has no custom domain yet.
 */
function attachLegacyDomain(d: DatabaseSync, legacy: string) {
  const dom = (process.env.LEGACY_DOMAIN || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!dom || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(dom)) return;
  const root = rootDomain();
  if (root && (dom === root || dom.endsWith("." + root))) return;
  const t = d.prepare("SELECT domain FROM tenants WHERE slug = ?").get(legacy) as unknown as { domain: string } | undefined;
  if (!t || t.domain) return;
  if (d.prepare("SELECT 1 FROM tenants WHERE domain = ?").get(dom)) return;
  d.prepare("UPDATE tenants SET domain = ? WHERE slug = ?").run(dom, legacy);
  console.log(`[platform] Domain ${dom} attached to venue "${legacy}"`);
}

/**
 * LEGACY_TENANT=mycafe: existing data (data/cafe.db + data/uploads) is moved once to data/tenants/mycafe
 * and registered as a venue that never expires. The previous panel password (ADMIN_PASSWORD) is kept.
 */
function migrateLegacy(d: DatabaseSync) {
  const legacy = (process.env.LEGACY_TENANT || "").trim().toLowerCase();
  if (!legacy) return;
  const dir = tenantDir(legacy);
  const oldDb = path.join(DATA_DIR, "cafe.db");
  if (!fs.existsSync(path.join(dir, "cafe.db")) && fs.existsSync(oldDb)) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ["cafe.db", "cafe.db-wal", "cafe.db-shm", "uploads", "sms-errors.log"]) {
      const src = path.join(DATA_DIR, f);
      if (fs.existsSync(src)) fs.renameSync(src, path.join(dir, f));
    }
    console.log(`[platform] Existing data moved to venue "${legacy}"`);
  }
  const dbFile = path.join(dir, "cafe.db");
  if (!fs.existsSync(dbFile)) return;
  const exists = d.prepare("SELECT 1 FROM tenants WHERE slug = ?").get(legacy);
  if (exists) { attachLegacyDomain(d, legacy); return; }
  let name = legacy;
  try {
    const t = new DatabaseSync(dbFile);
    const r = t.prepare("SELECT value FROM settings WHERE key='cafe'").get() as unknown as { value: string } | undefined;
    if (r) name = (JSON.parse(r.value) as { name?: string }).name || legacy;
    const pw = t.prepare("SELECT value FROM settings WHERE key='admin_pw'").get();
    if (!pw) {
      // The previous password (ADMIN_PASSWORD) is carried over; if weak, the first login must change it
      const old = process.env.ADMIN_PASSWORD || "cafe1234";
      t.prepare("INSERT INTO settings (key, value) VALUES ('admin_pw', ?)").run(JSON.stringify(hashPassword(old)));
      if (isWeakPassword(old)) t.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_pw_weak', 'true')").run();
    }
    t.close();
  } catch (e) {
    console.error("[platform] Reading existing data:", e);
  }
  d.prepare(
    "INSERT INTO tenants (slug, name, kind, status, plan, expires_at, note, created_at) VALUES (?, ?, 'cafe', 'active', 'lifetime', ?, 'Main venue (migrated from single-venue mode)', ?)"
  ).run(legacy, name, "2099-12-31T00:00:00.000Z", new Date().toISOString());
  attachLegacyDomain(d, legacy);
}
