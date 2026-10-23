import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR, rootDomain, tenantDir as tenantDirOf } from "@/lib/tenant-context";
import { DatabaseSync } from "node:sqlite";
import {
  listPayments, listTenants, pdb, platformSettings, platformSmsReady, rawGet, rawSet, sendPlatformSms, tenantState,
  type Plan, type Tenant,
} from "@/lib/platform";
import { DEFAULT_CONTENT, fill, mergeContent, type SiteContent } from "@/lib/site-content";
import { SLUG_RE, type Article } from "@/lib/articles";
import { SEED_ARTICLES } from "@/lib/article-seeds";
import { CITY_SLUG, SEED_CITIES, normCity, type City } from "@/lib/cities";
import { unseal } from "@/lib/secret-box";
import { toFa } from "@/lib/utils";

const DAY = 86_400_000;
const now = () => new Date().toISOString();

/* ============================ محتوای سایت ============================ */
const OLD_SEO = {
  title: ["{brand} — منوی QR، سفارش آنلاین و پنل مدیریت", ""],
  description: ["منوی QR، سفارش آنلاین و پنل مدیریت برای کافه، رستوران و فست‌فود. {trialDays} روز رایگان.", ""],
};
export function siteContent(): SiteContent {
  const c = mergeContent(rawGet<Partial<SiteContent>>("content", {}));
  // نامِ برندِ نسخه‌های قبلی (تنظیمات) اگر محتوا هنوز ذخیره نشده
  if (!rawGet<unknown>("content", null)) c.brand.name = platformSettings().brand || DEFAULT_CONTENT.brand.name;
  // عنوان/توضیحِ پیش‌فرضِ نسخه‌های قبل (اگر دستی عوض نشده) → نسخهٔ جدیدِ پرکلیدواژه
  if (OLD_SEO.title.includes(c.brand.seoTitle)) c.brand.seoTitle = DEFAULT_CONTENT.brand.seoTitle;
  if (OLD_SEO.description.includes(c.brand.seoDescription)) c.brand.seoDescription = DEFAULT_CONTENT.brand.seoDescription;
  return c;
}
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
/** عکسِ کارت فقط فایلِ آپلودشدهٔ خودِ پلتفرم یا آدرسِ https */
const CARD_IMG = /^(\/brand\/[\w.-]+\.webp|https:\/\/[^\s"'<>]{1,280})$/;
/** ذخیره با محدودیتِ طول (جلوگیری از ورودیِ بیش از حد) */
export function saveSiteContent(input: SiteContent) {
  const c = mergeContent(input);
  const t = (o: Record<string, unknown>, n = 400) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === "boolean" ? v : clip(v, n)]));
  const out: SiteContent = {
    brand: t(c.brand, 300) as SiteContent["brand"],
    announce: t(c.announce, 300) as SiteContent["announce"],
    hero: t(c.hero, 600) as SiteContent["hero"],
    kinds: c.kinds.slice(0, 12).map((k) => clip(k, 40)).filter(Boolean),
    trust: c.trust.slice(0, 6).map((k) => clip(k, 60)).filter(Boolean),
    showcase: { title: clip(c.showcase.title, 200), text: clip(c.showcase.text, 600), bullets: c.showcase.bullets.slice(0, 8).map((b) => clip(b, 100)).filter(Boolean) },
    finalCta: t(c.finalCta, 300) as SiteContent["finalCta"],
    features: { title: clip(c.features.title, 200), subtitle: clip(c.features.subtitle, 400), items: c.features.items.slice(0, 16).map((f) => ({ icon: clip(f.icon, 40), title: clip(f.title, 80), text: clip(f.text, 300), ...(f.hidden ? { hidden: true } : {}), ...(CARD_IMG.test(f.image || "") ? { image: f.image } : {}) })).filter((f) => f.title), autoplay: Math.min(20, Math.max(0, Math.round((Number(c.features.autoplay) || 0) * 2) / 2)) },
    views: {
      title: clip(c.views.title, 200), subtitle: clip(c.views.subtitle, 400),
      items: DEFAULT_CONTENT.views.items.map((d, i) => ({ title: clip(c.views.items[i]?.title || d.title, 60), text: clip(c.views.items[i]?.text ?? d.text, 300) })),
      bullets: c.views.bullets.slice(0, 8).map((b) => clip(b, 60)).filter(Boolean),
    },
    steps: { title: clip(c.steps.title, 200), items: c.steps.items.slice(0, 6).map((s) => ({ title: clip(s.title, 80), text: clip(s.text, 300) })).filter((s) => s.title) },
    pricing: { title: clip(c.pricing.title, 200), subtitle: clip(c.pricing.subtitle, 300), bullets: c.pricing.bullets.slice(0, 10).map((b) => clip(b, 80)).filter(Boolean), cta: clip(c.pricing.cta, 60) },
    faq: { title: clip(c.faq.title, 200), items: c.faq.items.slice(0, 30).map((f) => ({ q: clip(f.q, 200), a: clip(f.a, 1500) })).filter((f) => f.q) },
    footer: t(c.footer, 300) as SiteContent["footer"],
    testimonials: {
      title: clip(c.testimonials.title, 200), subtitle: clip(c.testimonials.subtitle, 300),
      items: c.testimonials.items.slice(0, 24).map((x) => ({
        name: clip(x.name, 60).trim(), person: clip(x.person, 60).trim(), role: clip(x.role, 60).trim(), city: clip(x.city, 40).trim(),
        text: clip(x.text, 500).trim(), logo: CARD_IMG.test(x.logo || "") ? x.logo : "",
      })).filter((x) => x.name && x.text),
    },
    signup: { ...(t(c.signup, 300) as SiteContent["signup"]), requireTerms: !!c.signup.requireTerms },
    login: t(c.login, 300) as SiteContent["login"],
    legal: { terms: clip(c.legal.terms, 30000), privacy: clip(c.legal.privacy, 30000) },
    unavailable: t(c.unavailable, 400) as SiteContent["unavailable"],
  };
  out.announce.enabled = !!c.announce.enabled;
  if (!out.brand.name.trim()) throw new Error("نامِ برند خالی است");
  rawSet("content", out);
  return out;
}
/** متغیرهای قابلِ استفاده در متن‌ها */
export function contentVars(c: SiteContent = siteContent()) {
  return { brand: c.brand.name, trialDays: toFa(platformSettings().trialDays), root: rootDomain() || "example.com" };
}
export const fillContent = (text: string, c?: SiteContent) => fill(text, contentVars(c));

/* ---------- لوگوی پلتفرم (data/platform-assets، سرو با /brand/<file>) ---------- */
export const ASSETS_DIR = path.join(DATA_DIR, "platform-assets");
/** تصویرِ پیش‌نمایشِ لینک (۱۲۰۰×۶۳۰) */
export async function savePlatformOgImage(buf: Buffer): Promise<string> {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const file = `og-${crypto.randomBytes(6).toString("hex")}.webp`;
  fs.writeFileSync(path.join(ASSETS_DIR, file), await sharp(buf).rotate().resize(1200, 630, { fit: "cover" }).webp({ quality: 86 }).toBuffer());
  return "/brand/" + file;
}
/** عکسِ کارت‌های امکانات؛ برش نمی‌خورد (سایت با object-cover پر می‌کند)، فقط حداکثر ۱۶۰۰ پیکسل */
export async function savePlatformCardImage(buf: Buffer): Promise<string> {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const file = `card-${crypto.randomBytes(6).toString("hex")}.webp`;
  const out = await sharp(buf).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
  fs.writeFileSync(path.join(ASSETS_DIR, file), out);
  return "/brand/" + file;
}
export async function savePlatformLogo(buf: Buffer): Promise<string> {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const file = `logo-${crypto.randomBytes(6).toString("hex")}.webp`;
  const out = await sharp(buf).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
  fs.writeFileSync(path.join(ASSETS_DIR, file), out);
  return "/brand/" + file;
}

/* ============================ گزارشِ فعالیت ============================ */
export function audit(actor: string, action: string, target = "", detail = "", ip = "") {
  try {
    pdb().prepare("INSERT INTO audit (at, actor, action, target, detail, ip) VALUES (?,?,?,?,?,?)").run(now(), actor, action, clip(target, 120), clip(detail, 500), clip(ip, 60));
  } catch (e) {
    console.error("[audit]", e);
  }
}
export interface AuditRow { id: number; at: string; actor: string; action: string; target: string; detail: string; ip: string }
export function listAudit(limit = 300, q = ""): AuditRow[] {
  const like = `%${q}%`;
  const rows = q
    ? pdb().prepare("SELECT * FROM audit WHERE action LIKE ? OR target LIKE ? OR detail LIKE ? ORDER BY id DESC LIMIT ?").all(like, like, like, limit)
    : pdb().prepare("SELECT * FROM audit ORDER BY id DESC LIMIT ?").all(limit);
  // ردیف‌های node:sqlite بدونِ prototype‌اند و Next آن‌ها را به مرورگر نمی‌فرستد ← شیءِ ساده
  return rows.map((r) => ({ ...r })) as unknown as AuditRow[];
}

/* ============================ کدهای تخفیف ============================ */
export interface Coupon {
  code: string; kind: "percent" | "amount"; value: number; maxUses: number; used: number;
  expiresAt: string; plans: string[]; active: boolean; note: string; createdAt: string;
}
type CRow = { code: string; kind: string; value: number; max_uses: number; used: number; expires_at: string; plans: string; active: number; note: string; created_at: string };
const toCoupon = (r: CRow): Coupon => ({
  code: r.code, kind: r.kind === "amount" ? "amount" : "percent", value: r.value, maxUses: r.max_uses, used: r.used,
  expiresAt: r.expires_at || "", plans: (r.plans || "").split(",").filter(Boolean), active: !!r.active, note: r.note || "", createdAt: r.created_at,
});
export function listCoupons(): Coupon[] {
  return (pdb().prepare("SELECT * FROM coupons ORDER BY created_at DESC").all() as unknown as CRow[]).map(toCoupon);
}
export function saveCoupon(c: Partial<Coupon> & { code: string }) {
  const code = String(c.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error("کد باید ۳ تا ۲۴ حرفِ انگلیسی/عدد باشد (مثل NOROOZ1405)");
  const kind = c.kind === "amount" ? "amount" : "percent";
  const value = Math.round(Number(c.value) || 0);
  if (kind === "percent" && (value < 1 || value > 100)) throw new Error("درصد باید بین ۱ تا ۱۰۰ باشد");
  if (kind === "amount" && value < 1000) throw new Error("مبلغِ تخفیف (تومان) را درست وارد کنید");
  const expires = c.expiresAt ? new Date(c.expiresAt) : null;
  if (expires && isNaN(+expires)) throw new Error("تاریخِ انقضا نامعتبر است");
  pdb().prepare(
    `INSERT INTO coupons (code, kind, value, max_uses, expires_at, plans, active, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value, max_uses=excluded.max_uses, expires_at=excluded.expires_at,
       plans=excluded.plans, active=excluded.active, note=excluded.note`
  ).run(code, kind, value, Math.max(0, Math.round(Number(c.maxUses) || 0)), expires ? expires.toISOString() : "",
    (c.plans || []).join(","), c.active === false ? 0 : 1, clip(c.note, 200), now());
  return code;
}
export function deleteCoupon(code: string) {
  pdb().prepare("DELETE FROM coupons WHERE code = ?").run(String(code).toUpperCase());
}
/** اعمالِ کد روی یک طرح؛ خروجی: مبلغِ نهایی و تخفیف. خطا با پیامِ فارسی */
export function applyCoupon(rawCode: string, plan: Plan): { code: string; discount: number; amount: number } {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { code: "", discount: 0, amount: plan.price };
  const r = pdb().prepare("SELECT * FROM coupons WHERE code = ?").get(code) as unknown as CRow | undefined;
  const c = r && toCoupon(r);
  if (!c || !c.active) throw new Error("کدِ تخفیف معتبر نیست");
  if (c.expiresAt && +new Date(c.expiresAt) < Date.now()) throw new Error("مهلتِ این کدِ تخفیف تمام شده است");
  if (c.maxUses && c.used >= c.maxUses) throw new Error("ظرفیتِ این کدِ تخفیف تمام شده است");
  if (c.plans.length && !c.plans.includes(plan.id)) throw new Error("این کد برای طرحِ انتخاب‌شده نیست");
  const discount = Math.min(plan.price, c.kind === "percent" ? Math.round((plan.price * c.value) / 100) : c.value);
  return { code, discount, amount: plan.price - discount };
}

/* ============================ اعلان داخلِ پنلِ مجموعه‌ها ============================ */
export interface Announcement { enabled: boolean; text: string; level: "info" | "warning"; until: string }
export function announcement(): Announcement {
  return { enabled: false, text: "", level: "info", until: "", ...rawGet<Partial<Announcement>>("announcement", {}) };
}
export function activeAnnouncement(): Announcement | null {
  const a = announcement();
  if (!a.enabled || !a.text.trim()) return null;
  if (a.until && +new Date(a.until) < Date.now()) return null;
  return a;
}
export function saveAnnouncement(a: Announcement) {
  rawSet("announcement", { enabled: !!a.enabled, text: clip(a.text, 500), level: a.level === "warning" ? "warning" : "info", until: a.until ? new Date(a.until).toISOString() : "" });
}

/* ============================ یادآوریِ تمدید (پیامک) ============================ */
export interface NotifySettings {
  enabled: boolean;
  days: number[];
  expired: boolean;
  template: string;
  expiredTemplate: string;
}
export const DEFAULT_NOTIFY: NotifySettings = {
  enabled: false,
  days: [7, 3, 1],
  expired: true,
  template: "{brand}\nاشتراکِ «{name}» {days} روزِ دیگر تمام می‌شود. تمدید از پنل ← اشتراک:\n{link}",
  expiredTemplate: "{brand}\nاشتراکِ «{name}» تمام شد و منو برای مشتری‌ها غیرفعال است. تمدید:\n{link}",
};
export function notifySettings(): NotifySettings {
  const s = { ...DEFAULT_NOTIFY, ...rawGet<Partial<NotifySettings>>("notify", {}) };
  return { ...s, days: (s.days || []).map(Number).filter((n) => n > 0 && n <= 60).slice(0, 5) };
}
export function saveNotifySettings(s: NotifySettings) {
  rawSet("notify", {
    enabled: !!s.enabled, expired: !!s.expired,
    days: [...new Set((s.days || []).map((n) => Math.round(Number(n))).filter((n) => n > 0 && n <= 60))].sort((a, b) => b - a).slice(0, 5),
    template: clip(s.template, 500), expiredTemplate: clip(s.expiredTemplate, 500),
  });
}
function tenantPanelLink(t: Tenant) {
  return `https://${t.domain || `${t.slug}.${rootDomain()}`}/staff`;
}
const ownerVars = (t: Tenant, days: number) => ({ ...contentVars(), name: t.name, slug: t.slug, days: toFa(days), link: tenantPanelLink(t) });

/** بررسی و ارسالِ یادآوری‌ها (هر ساعت خودکار، یا دستی از پنل). هر یادآوری برای هر دورهٔ اشتراک یک‌بار. */
export async function runReminders(force = false): Promise<{ sent: number; failed: number; skipped: number }> {
  const s = notifySettings();
  const res = { sent: 0, failed: 0, skipped: 0 };
  if ((!s.enabled && !force) || !platformSmsReady()) return res;
  for (const t of listTenants()) {
    if (!t.ownerPhone || t.expiresAt.startsWith("2099") || t.status === "suspended") continue;
    const st = tenantState(t);
    let kind = "";
    if (st.active && s.days.includes(st.daysLeft)) kind = `d${st.daysLeft}`;
    else if (!st.active && st.state === "expired" && s.expired && st.daysLeft > -3) kind = "expired";
    if (!kind) continue;
    const key = `${t.slug}|${kind}|${t.expiresAt.slice(0, 10)}`;
    if (pdb().prepare("SELECT 1 FROM reminders WHERE key = ?").get(key)) { res.skipped++; continue; }
    const text = fill(kind === "expired" ? s.expiredTemplate : s.template, ownerVars(t, Math.max(0, st.daysLeft)));
    try {
      await sendPlatformSms(t.ownerPhone, text);
      pdb().prepare("INSERT INTO reminders (key, slug, kind, at, status) VALUES (?,?,?,?, 'sent')").run(key, t.slug, kind, now());
      res.sent++;
    } catch (e) {
      pdb().prepare("INSERT OR REPLACE INTO reminders (key, slug, kind, at, status, detail) VALUES (?,?,?,?, 'failed', ?)").run(key + "|f" + Date.now(), t.slug, kind, now(), clip(e instanceof Error ? e.message : e, 200));
      res.failed++;
    }
  }
  if (res.sent || res.failed) audit("system", "یادآوریِ تمدید", "", `ارسال ${res.sent} · ناموفق ${res.failed}`);
  return res;
}
export function listReminders(limit = 100) {
  return pdb().prepare("SELECT * FROM reminders ORDER BY at DESC LIMIT ?").all(limit).map((r) => ({ ...r })) as unknown as { key: string; slug: string; kind: string; at: string; status: string; detail: string }[];
}

/* ============================ پیامکِ گروهی به صاحبانِ مجموعه‌ها ============================ */
export type OwnerAudience = "all" | "active" | "trial" | "expired" | "expiring";
export function ownersFor(aud: OwnerAudience): Tenant[] {
  return listTenants().filter((t) => {
    if (!t.ownerPhone) return false;
    const st = tenantState(t);
    if (aud === "all") return true;
    if (aud === "expiring") return st.active && st.daysLeft <= 7 && !t.expiresAt.startsWith("2099");
    return st.state === aud;
  });
}
const g = globalThis as unknown as { __ownerSmsRunning?: Set<string> };
const ownerRunning = (g.__ownerSmsRunning ??= new Set());
export function startOwnerSms(message: string, aud: OwnerAudience, only?: string): { id: string; total: number } {
  const msg = String(message || "").trim();
  if (!msg) throw new Error("متنِ پیامک را بنویسید");
  if (msg.length > 600) throw new Error("متن بیش از ۶۰۰ نویسه است");
  if (!platformSmsReady()) throw new Error("سامانهٔ پیامکِ پلتفرم تنظیم نشده (تنظیمات ← پیامکِ پلتفرم)");
  const list = only ? listTenants().filter((t) => t.slug === only && t.ownerPhone) : ownersFor(aud);
  if (!list.length) throw new Error("گیرنده‌ای (با شمارهٔ موبایل) پیدا نشد");
  const id = `osm_${crypto.randomBytes(8).toString("hex")}`;
  pdb().prepare("INSERT INTO owner_sms (id, at, message, audience, total) VALUES (?,?,?,?,?)").run(id, now(), msg, only ? `single:${only}` : aud, list.length);
  ownerRunning.add(id);
  void (async () => {
    let sent = 0, failed = 0;
    for (const t of list) {
      try { await sendPlatformSms(t.ownerPhone, fill(msg, ownerVars(t, Math.max(0, tenantState(t).daysLeft)))); sent++; }
      catch { failed++; }
      pdb().prepare("UPDATE owner_sms SET sent = ?, failed = ? WHERE id = ?").run(sent, failed, id);
      await new Promise((r) => setTimeout(r, 300));
    }
    pdb().prepare("UPDATE owner_sms SET status = 'done' WHERE id = ?").run(id);
    ownerRunning.delete(id);
  })();
  return { id, total: list.length };
}
export function listOwnerSms() {
  return pdb().prepare("SELECT * FROM owner_sms ORDER BY at DESC LIMIT 30").all().map((r) => ({ ...r })) as unknown as { id: string; at: string; message: string; audience: string; total: number; sent: number; failed: number; status: string }[];
}

/* ============================ آمارِ داشبورد ============================ */
const jFmt = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: "Asia/Tehran", year: "numeric", month: "numeric" });
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
function jMonth(d: Date) {
  const p = Object.fromEntries(jFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { key: `${p.year}-${String(p.month).padStart(2, "0")}`, label: `${MONTHS[Number(p.month) - 1]}` };
}
export interface PlatformStats {
  months: { key: string; label: string; signups: number; revenue: number }[];
  revenueThisMonth: number; revenueLastMonth: number; signups30: number; signups7: number;
  mrr: number; expiringSoon: { slug: string; name: string; daysLeft: number; phone: string }[];
  recentSignups: { slug: string; name: string; at: string }[];
}
export function platformStats(): PlatformStats {
  const tenants = listTenants();
  const payments = listPayments(undefined, 5000).filter((p) => p.status === "paid");
  const months: PlatformStats["months"] = [];
  const idx = new Map<string, number>();
  // ۱۲ ماهِ شمسیِ اخیر (ماهِ جاری آخر). از امروز با گام‌های چندروزه عقب می‌رویم؛
  // مرزِ ماهِ شمسی وسطِ ماهِ میلادی است و ساختن از «روزِ ۱۵ِ هر ماهِ میلادی» ماهِ جاری را بعد از ~۲۲ام جا می‌انداخت
  const keys: { key: string; label: string }[] = [];
  for (let back = 0; keys.length < 12 && back < 400; back += 7) {
    const m = jMonth(new Date(Date.now() - back * DAY));
    if (!keys.some((k) => k.key === m.key)) keys.push(m);
  }
  for (const m of keys.reverse()) {
    idx.set(m.key, months.length);
    months.push({ ...m, signups: 0, revenue: 0 });
  }
  for (const t of tenants) { const k = jMonth(new Date(t.createdAt)).key; if (idx.has(k)) months[idx.get(k)!].signups++; }
  for (const p of payments) { const k = jMonth(new Date(p.paidAt || p.createdAt)).key; if (idx.has(k)) months[idx.get(k)!].revenue += p.amount; }
  // درآمدِ ماهانهٔ تکرارشونده (تقریبی): آخرین پرداختِ هر مجموعهٔ فعال تقسیم بر تعدادِ ماه‌ها
  let mrr = 0;
  const lastPay = new Map<string, { amount: number; months: number }>();
  for (const p of payments) if (!lastPay.has(p.slug) && p.amount > 0) lastPay.set(p.slug, { amount: p.amount, months: Math.max(1, p.months) });
  for (const t of tenants) { const lp = lastPay.get(t.slug); if (lp && tenantState(t).active) mrr += lp.amount / lp.months; }
  const cut = (days: number) => tenants.filter((t) => Date.now() - +new Date(t.createdAt) <= days * DAY).length;
  return {
    months,
    revenueThisMonth: months[months.length - 1]?.revenue || 0,
    revenueLastMonth: months[months.length - 2]?.revenue || 0,
    signups30: cut(30), signups7: cut(7), mrr: Math.round(mrr),
    expiringSoon: tenants.map((t) => ({ t, st: tenantState(t) }))
      .filter(({ t, st }) => st.active && st.daysLeft <= 7 && !t.expiresAt.startsWith("2099"))
      .sort((a, b) => a.st.daysLeft - b.st.daysLeft).slice(0, 20)
      .map(({ t, st }) => ({ slug: t.slug, name: t.name, daysLeft: st.daysLeft, phone: t.ownerPhone })),
    recentSignups: tenants.slice(0, 8).map((t) => ({ slug: t.slug, name: t.name, at: t.createdAt })),
  };
}

/* ============================ مشتریانِ همهٔ مجموعه‌ها ============================ */
export interface PlatformCustomer {
  phone: string; slug: string; tenant: string; visits: number; firstSeen: string; lastSeen: string; optOut: boolean; tables: string;
}
/** شماره‌هایی که مشتریان در منوی هر مجموعه با کدِ پیامکی تأیید کرده‌اند (فقط خواندنی، از دیتابیسِ هر مجموعه) */
export function allCustomers(onlySlug = ""): { rows: PlatformCustomer[]; perTenant: { slug: string; name: string; count: number }[] } {
  const rows: PlatformCustomer[] = [];
  const perTenant: { slug: string; name: string; count: number }[] = [];
  for (const t of listTenants()) {
    if (onlySlug && t.slug !== onlySlug) continue;
    const file = path.join(tenantDirOf(t.slug), "cafe.db");
    if (!fs.existsSync(file)) { perTenant.push({ slug: t.slug, name: t.name, count: 0 }); continue; }
    try {
      const d = new DatabaseSync(file, { readOnly: true });
      let list: Record<string, unknown>[];
      try { list = d.prepare("SELECT phone, tables, visits, first_seen, last_seen, sms_optout FROM customers ORDER BY last_seen DESC").all(); }
      catch { list = d.prepare("SELECT phone, tables, visits, first_seen, last_seen, 0 AS sms_optout FROM customers ORDER BY last_seen DESC").all(); }
      d.close();
      for (const r of list) rows.push({
        phone: String(r.phone), slug: t.slug, tenant: t.name, visits: Number(r.visits) || 1, firstSeen: String(r.first_seen || ""),
        lastSeen: String(r.last_seen || ""), optOut: !!r.sms_optout, tables: String(r.tables || ""),
      });
      perTenant.push({ slug: t.slug, name: t.name, count: list.length });
    } catch {
      perTenant.push({ slug: t.slug, name: t.name, count: 0 });
    }
  }
  rows.sort((a, b) => (b.lastSeen > a.lastSeen ? 1 : -1));
  perTenant.sort((a, b) => b.count - a.count);
  return { rows, perTenant };
}

/* ============================ مقاله‌ها (وبلاگ) ============================ */
const ART_COVER = /^(\/brand\/[\w.-]+\.webp|https:\/\/[^\s"'<>]{1,280})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function listArticles(): Article[] {
  return rawGet<Article[] | null>("articles", null) ?? SEED_ARTICLES;
}
export function publishedArticles(): Article[] {
  return listArticles().filter((a) => a.published).sort((a, b) => b.date.localeCompare(a.date));
}
export function getArticle(slug: string): Article | undefined {
  return listArticles().find((a) => a.slug === slug);
}
/** ذخیره/ویرایشِ یک مقاله؛ prevSlug برای وقتی آدرسِ مقاله عوض شده */
export function saveArticle(input: Article, prevSlug?: string): Article {
  const today = new Date().toISOString().slice(0, 10);
  const a: Article = {
    slug: clip(input.slug, 80).trim().toLowerCase(),
    title: clip(input.title, 160).trim(),
    description: clip(input.description, 300).trim(),
    cover: ART_COVER.test(input.cover || "") ? input.cover || "" : "",
    body: clip(input.body, 60000),
    published: !!input.published,
    date: DATE_RE.test(input.date) ? input.date : today,
    updated: today,
  };
  if (!SLUG_RE.test(a.slug)) throw new Error("آدرسِ مقاله فقط حروفِ انگلیسیِ کوچک، عدد و خط‌تیره (مثل qr-menu-guide)");
  if (!a.title) throw new Error("عنوانِ مقاله خالی است");
  const list = listArticles().filter((x) => x.slug !== (prevSlug || a.slug));
  if (list.some((x) => x.slug === a.slug)) throw new Error("مقاله‌ای با این آدرس وجود دارد");
  rawSet("articles", [a, ...list].slice(0, 300));
  return a;
}
export function deleteArticle(slug: string) {
  rawSet("articles", listArticles().filter((a) => a.slug !== slug));
}

/* ============================ صفحه‌های شهری ============================ */
export function listCities(): City[] {
  return rawGet<City[] | null>("cities", null) ?? SEED_CITIES;
}
export function getCity(slug: string): City | undefined {
  return listCities().find((c) => c.slug === slug);
}
export function saveCity(input: City, prevSlug?: string): City {
  const c: City = {
    slug: clip(input.slug, 30).trim().toLowerCase(),
    name: clip(input.name, 40).trim(),
    intro: clip(input.intro, 2000).trim(),
    body: clip(input.body, 30000),
    published: !!input.published,
    updated: new Date().toISOString().slice(0, 10),
  };
  if (!CITY_SLUG.test(c.slug)) throw new Error("آدرسِ صفحه فقط حروفِ انگلیسیِ کوچک، عدد و خط‌تیره (مثل shiraz)");
  if (!c.name) throw new Error("نامِ شهر را وارد کنید");
  const rest = listCities().filter((x) => x.slug !== (prevSlug || c.slug));
  if (rest.some((x) => x.slug === c.slug)) throw new Error("صفحه‌ای با این آدرس وجود دارد");
  rawSet("cities", [...rest, c].sort((a, b) => a.name.localeCompare(b.name, "fa")));
  return c;
}
export function deleteCity(slug: string) {
  rawSet("cities", listCities().filter((c) => c.slug !== slug));
}

/** شهرِ هر مجموعه (از تنظیماتِ خودش) — ۱۰ دقیقه در حافظه، چون باید دیتابیسِ همهٔ مجموعه‌ها خوانده شود */
const cityCache = globalThis as unknown as { __tenantCities?: { at: number; map: Map<string, string> } };
function tenantCities(): Map<string, string> {
  const c = cityCache.__tenantCities;
  if (c && Date.now() - c.at < 10 * 60_000) return c.map;
  const map = new Map<string, string>();
  for (const t of listTenants()) {
    const file = path.join(tenantDirOf(t.slug), "cafe.db");
    if (!fs.existsSync(file)) continue;
    try {
      const d = new DatabaseSync(file, { readOnly: true });
      const r = d.prepare("SELECT value FROM settings WHERE key = 'cafe'").get() as { value: string } | undefined;
      d.close();
      const city = r ? String((JSON.parse(unseal(r.value)) as { city?: string }).city || "") : "";
      if (city) map.set(t.slug, normCity(city));
    } catch { /* دیتابیسِ خراب یا قفل: رد شو */ }
  }
  cityCache.__tenantCities = { at: Date.now(), map };
  return map;
}
/** منوهای فعال و عمومیِ یک شهر (برای صفحهٔ همان شهر؛ منوی نمونه و منقضی‌ها نه) */
export function tenantsInCity(name: string): Tenant[] {
  const key = normCity(name);
  const map = tenantCities();
  return listTenants().filter((t) => t.plan !== "demo" && map.get(t.slug) === key && tenantState(t).active).slice(0, 24);
}
