"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { assertNotLocked, checkCode, hit, issueCode } from "@/lib/limits";
import { clientIp } from "@/lib/security";
import { saasEnabled, rootDomain } from "@/lib/tenant-context";
import { classifyHost, platformUrl, requestHost, requestProto, tenantUrl } from "@/lib/tenant";
import {
  checkPlatformAdmin, createPayment, createTenant, deleteTenant, extendTenant, getPayment, getTenant,
  listPayments, listTenants, markPaymentFailed, markPaymentPaid, platformAdminConfigured, platformSettings,
  platformSmsReady, savePlatformSettings, sendPlatformSms, setPlatformAdminPassword, signPlatform, slugAvailable,
  tenantState, tenantStats, updateTenant, validateSlug, verifyPlatform,
  type Payment, type PlatformSettings, type Tenant,
} from "@/lib/platform";
import { runAsTenant } from "@/lib/tenant-context";
import { setSetting } from "@/lib/queries";
import { hashPassword } from "@/lib/auth";
import { ensureCert } from "@/lib/certs";
import { isValidPhone, normalizePhone } from "@/lib/otp";
import type { BusinessKind } from "@/lib/seeds";
import type { ActionFail } from "@/lib/action-result";
import {
  announcement, applyCoupon, audit, deleteCoupon, listAudit, listCoupons, listOwnerSms, listReminders,
  notifySettings, ownersFor, platformStats, runReminders, saveAnnouncement, saveCoupon, saveNotifySettings, savePlatformLogo,
  saveSiteContent, siteContent, startOwnerSms, allCustomers, savePlatformOgImage, savePlatformCardImage, listArticles, saveArticle, deleteArticle, listCities, saveCity, deleteCity,
  type Announcement, type AuditRow, type Coupon, type NotifySettings, type OwnerAudience, type PlatformStats, type PlatformCustomer,
} from "@/lib/platform-admin";
import { readUpload } from "@/lib/images";
import type { SiteContent } from "@/lib/site-content";
import type { Article } from "@/lib/articles";
import type { City } from "@/lib/cities";
import { REF_COOKIE, activeRef, addPayout, deletePartner, getPartner, listPartners, partnerStats, savePartner, type Partner, type PartnerStats } from "@/lib/partners";

/** خطای فارسی به مرورگر برسد (Next در production پیامِ خطای اکشن را پنهان می‌کند) */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    await assertPlatformHost();
    return await fn();
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "خطا" };
  }
}
/** اکشن‌های پلتفرم فقط روی دامنهٔ اصلی (نه زیردامنهٔ مجموعه‌ها) */
async function assertPlatformHost() {
  if (!saasEnabled()) throw new Error("حالتِ چندمستاجری فعال نیست");
  if (classifyHost((await requestHost()).host).kind !== "platform") throw new Error("دسترسی مجاز نیست");
}
/* محدودیت‌ها و کدها روی دیسک (lib/limits) — با ری‌استارت پاک نمی‌شوند */
const limit = (key: string, max: number, windowMs: number) => hit("pf:" + key, max, windowMs);

/* ============================ ثبت‌نام ============================ */
export async function checkSlugAction(raw: string): Promise<{ ok: boolean; slug: string; message: string }> {
  try {
    await assertPlatformHost();
    const slug = validateSlug(raw);
    return slugAvailable(slug) ? { ok: true, slug, message: "این آدرس آزاد است ✓" } : { ok: false, slug, message: "این آدرس قبلاً گرفته شده است" };
  } catch (e) {
    return { ok: false, slug: "", message: e instanceof Error ? e.message : "خطا" };
  }
}

export async function signupOtpAction(rawPhone: string) {
  return guard(async () => {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    if (!platformSmsReady()) return { ok: true, required: false };
    limit("otp-ip:" + (await clientIp()), 5, 10 * 60_000);
    limit("otp-phone:" + phone, 3, 10 * 60_000);
    const code = issueCode("pf-signup:" + phone, 5 * 60_000);
    await sendPlatformSms(phone, `${siteContent().brand.name}\nکد تأیید ثبت‌نام: ${code}`).catch(() => {
      throw new Error("ارسال پیامک انجام نشد؛ کمی بعد دوباره تلاش کنید");
    });
    return { ok: true, required: true };
  });
}

export interface SignupInput {
  name: string; kind: BusinessKind; slug: string; ownerName: string; phone: string;
  password: string; code?: string; sample: boolean; website?: string;
  /** کدِ همکارِ معرف (اختیاری؛ اگر خالی باشد از کوکیِ لینکِ همکار) */
  ref?: string;
}
/** ساختِ مجموعه + دورهٔ آزمایشی؛ خروجی: آدرسِ ورودِ خودکار به پنلِ مجموعه */
export async function signupAction(input: SignupInput) {
  return guard(async () => {
    const ps = platformSettings();
    if (!ps.allowSignup) throw new Error("ثبت‌نامِ آنلاین فعلاً بسته است؛ با پشتیبانی تماس بگیرید");
    if (input.website) throw new Error("درخواست نامعتبر"); // تلهٔ ربات‌ها (فیلدِ مخفی)
    limit("signup:" + (await clientIp()), 5, 60 * 60_000);
    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    if (platformSmsReady()) checkCode("pf-signup:" + phone, normalizePhone(input.code || ""));
    const t = createTenant({
      slug: input.slug, name: input.name, kind: input.kind, ownerName: input.ownerName, ownerPhone: phone,
      password: input.password, sample: input.sample,
      ref: activeRef(input.ref) || activeRef((await cookies()).get(REF_COOKIE)?.value),
    });
    audit(input.ownerName || phone, "ثبت‌نامِ آنلاینِ مجموعه", t.slug, `${t.name} · ${phone}`, await clientIp());
    return { ...(await enterLink(t)), slug: t.slug, trialDays: ps.trialDays };
  });
}

/** لینکِ ورودِ یک‌بارمصرف به پنلِ مجموعه (برای ثبت‌نامِ تازه و «ورود» از پنلِ مدیرِ کل) */
async function enterLink(t: Tenant): Promise<{ url: string; host: string }> {
  const host = t.domain || `${t.slug}.${rootDomain()}`;
  // روی سرورِ واقعی برای زیردامنهٔ تازه گواهیِ HTTPS گرفته می‌شود (چند ثانیه)؛ اگر نشد با http باز می‌شود
  let url = await tenantUrl(t, "/staff/enter?t=" + encodeURIComponent(signPlatform({ slug: t.slug, p: "enter" }, 5 * 60_000)));
  if ((await requestProto()) === "https" && process.env.AUTO_SSL === "1" && !(await ensureCert(host))) url = url.replace(/^https:/, "http:");
  return { url, host };
}

export async function findPanelAction(raw: string) {
  return guard(async () => {
    limit("find:" + (await clientIp()), 30, 10 * 60_000);
    const slug = String(raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0];
    const t = slug && getTenant(slug);
    if (!t) throw new Error("مجموعه‌ای با این آدرس پیدا نشد");
    return { url: await tenantUrl(t, "/staff") };
  });
}

/* ============================ مدیرِ کل ============================ */
const ADMIN_COOKIE = "platform_admin";
async function isPlatformAdmin(): Promise<boolean> {
  const d = verifyPlatform<{ r: string }>((await cookies()).get(ADMIN_COOKIE)?.value);
  return d?.r === "admin";
}
/** ثبتِ کارِ مدیرِ کل در گزارشِ فعالیت */
async function log(action: string, target = "", detail = "") {
  audit("مدیرِ کل", action, target, detail, await clientIp());
}
async function adminGuard<T>(fn: () => Promise<T> | T) {
  return guard(async () => {
    if (!(await isPlatformAdmin())) throw new Error("ابتدا وارد شوید");
    return fn();
  });
}

export async function adminStatusAction(): Promise<{ authed: boolean; configured: boolean }> {
  try {
    await assertPlatformHost();
    return { authed: await isPlatformAdmin(), configured: platformAdminConfigured() };
  } catch {
    return { authed: false, configured: false };
  }
}
export async function adminLoginAction(password: string) {
  return guard(async () => {
    if (!platformAdminConfigured()) throw new Error("رمزِ مدیرِ کل تنظیم نشده (PLATFORM_ADMIN_PASSWORD در سرور)");
    assertNotLocked("pf:admin-login:" + (await clientIp()), 8, 15 * 60_000);
    assertNotLocked("pf:admin-login", 30, 15 * 60_000);
    if (!checkPlatformAdmin(password)) {
      // فقط تلاش‌های ناموفق شمرده می‌شوند: ۸ در ۱۵ دقیقه برای هر IP، ۳۰ برای همه
      limit("admin-login:" + (await clientIp()), 8, 15 * 60_000);
      limit("admin-login", 30, 15 * 60_000);
      audit("ناشناس", "ورودِ ناموفق به پنلِ مدیرِ کل", "", "", await clientIp());
      throw new Error("رمز اشتباه است");
    }
    (await cookies()).set(ADMIN_COOKIE, signPlatform({ r: "admin" }, 12 * 3600_000), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 3600, secure: (await requestProto()) === "https",
    });
    await log("ورود به پنلِ مدیرِ کل");
    return { ok: true };
  });
}
export async function adminLogoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  return { ok: true };
}

export interface AdminTenant extends Tenant {
  state: ReturnType<typeof tenantState>["state"]; daysLeft: number;
  stats: ReturnType<typeof tenantStats>; url: string;
}
export interface AdminData {
  root: string;
  tenants: AdminTenant[];
  payments: (Payment & { tenantName: string; receiptUrl: string })[];
  settings: PlatformSettings;
}
export async function adminDataAction() {
  return adminGuard(async (): Promise<AdminData> => {
    const tenants: AdminTenant[] = [];
    for (const t of listTenants()) {
      tenants.push({ ...t, ...tenantState(t), stats: tenantStats(t.slug), url: await tenantUrl(t, "/") });
    }
    const names = new Map(tenants.map((t) => [t.slug, t]));
    const payments = await Promise.all(listPayments().map(async (p) => {
      const t = names.get(p.slug);
      return { ...p, tenantName: t?.name || p.slug, receiptUrl: p.receipt && t ? await tenantUrl(t, p.receipt) : "" };
    }));
    return { root: rootDomain(), tenants, payments, settings: platformSettings() };
  });
}

export async function adminCreateTenantAction(input: { slug: string; name: string; kind: BusinessKind; ownerName: string; phone: string; password: string; months: number; sample: boolean }) {
  return adminGuard(async () => {
    const phone = input.phone ? normalizePhone(input.phone) : "";
    if (phone && !isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    const months = Math.max(0, Math.round(Number(input.months) || 0));
    const t = createTenant({
      slug: input.slug, name: input.name, kind: input.kind, ownerName: input.ownerName, ownerPhone: phone, password: input.password,
      sample: input.sample, days: months ? 0 : platformSettings().trialDays, plan: months ? "manual" : "trial", note: "ساخته‌شده توسط مدیر",
    });
    if (months) extendTenant(t.slug, months, "manual");
    await log("ساختِ مجموعه", t.slug, `${t.name}${months ? ` · ${months} ماه` : " · آزمایشی"}`);
    return { slug: t.slug };
  });
}

export async function adminUpdateTenantAction(slug: string, patch: { name?: string; ownerName?: string; ownerPhone?: string; status?: "active" | "suspended"; domain?: string; note?: string; kind?: BusinessKind }) {
  return adminGuard(async () => {
    if (patch.ownerPhone !== undefined && patch.ownerPhone) {
      patch.ownerPhone = normalizePhone(patch.ownerPhone);
      if (!isValidPhone(patch.ownerPhone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    }
    const t = updateTenant(slug, patch);
    if (patch.domain) void ensureCert(t.domain);
    await log(patch.status ? (patch.status === "suspended" ? "تعلیقِ مجموعه" : "رفعِ تعلیق") : "ویرایشِ مجموعه", slug, Object.keys(patch).join("، "));
    return { ok: true };
  });
}
/** تمدیدِ دستی (ماه/روز؛ روزِ منفی = کم‌کردن) یا تعیینِ مستقیمِ تاریخِ انقضا */
export async function adminExtendAction(slug: string, opts: { months?: number; days?: number; until?: string; amount?: number }) {
  return adminGuard(async () => {
    const t = getTenant(slug);
    if (!t) throw new Error("مجموعه پیدا نشد");
    if (opts.until) {
      const d = new Date(opts.until);
      if (isNaN(+d)) throw new Error("تاریخ نامعتبر است");
      updateTenant(slug, { expiresAt: d.toISOString(), plan: t.plan === "trial" ? "manual" : t.plan });
    } else if (opts.months && opts.months > 0) {
      // در تاریخچهٔ پرداخت‌ها هم ثبت می‌شود؛ markPaymentPaid خودش اشتراک را تمدید می‌کند
      const amount = Math.max(0, Math.round(Number(opts.amount) || 0));
      const p = createPayment({ slug, plan: { id: "manual", title: "دستی", months: Math.round(opts.months), price: amount }, method: "manual", note: amount ? "پرداختِ حضوری (ثبت توسط مدیر)" : "تمدید توسط مدیر" });
      markPaymentPaid(p.id);
    } else if (opts.days && opts.days > 0) {
      extendTenant(slug, 0, t.plan, Math.round(opts.days)); // از امروز یا از انقضای فعلی (هرکدام دیرتر)
    } else if (opts.days) {
      updateTenant(slug, { expiresAt: new Date(+new Date(t.expiresAt) + Math.round(opts.days) * 86_400_000).toISOString() });
    }
    await log("تغییرِ اعتبارِ اشتراک", slug, opts.until ? `تا ${opts.until}` : opts.months ? `+${opts.months} ماه${opts.amount ? ` · ${opts.amount} تومان` : ""}` : `${opts.days} روز`);
    return { ok: true };
  });
}
export async function adminResetPasswordAction(slug: string) {
  return adminGuard(async () => {
    if (!getTenant(slug)) throw new Error("مجموعه پیدا نشد");
    const pw = crypto.randomBytes(5).toString("hex");
    runAsTenant(slug, () => setSetting("admin_pw", hashPassword(pw)));
    await log("رمزِ جدید برای پنلِ مجموعه", slug);
    return { password: pw };
  });
}
export async function adminEnterAction(slug: string) {
  return adminGuard(async () => {
    const t = getTenant(slug);
    if (!t) throw new Error("مجموعه پیدا نشد");
    await log("ورود به پنلِ مجموعه", slug);
    return enterLink(t);
  });
}
export async function adminDeleteTenantAction(slug: string, confirmSlug: string) {
  return adminGuard(async () => {
    if (slug !== confirmSlug) throw new Error("برای حذف، آدرسِ مجموعه را دقیق وارد کنید");
    deleteTenant(slug);
    await log("حذفِ مجموعه", slug);
    return { ok: true };
  });
}
export async function adminPaymentAction(id: string, approve: boolean, note = "") {
  return adminGuard(async () => {
    const p = getPayment(id);
    if (!p || p.status !== "pending") throw new Error("این پرداخت در انتظارِ بررسی نیست");
    if (approve) markPaymentPaid(id, "", note || "تأیید فیش توسط مدیر");
    else markPaymentFailed(id, "rejected", note || "فیش تأیید نشد");
    await log(approve ? "تأییدِ فیش" : "ردِ فیش", p.slug, `${p.amount} تومان${note ? ` · ${note}` : ""}`);
    return { ok: true };
  });
}
export async function adminSaveSettingsAction(s: PlatformSettings) {
  return adminGuard(async () => { savePlatformSettings(s); await log("ذخیرهٔ تنظیماتِ پلتفرم"); return { ok: true }; });
}
export async function adminSetPasswordAction(pw: string) {
  return adminGuard(async () => { setPlatformAdminPassword(pw); await log("تغییرِ رمزِ مدیرِ کل"); return { ok: true }; });
}
export async function adminTestSmsAction(rawPhone: string) {
  return adminGuard(async () => {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    return { detail: await sendPlatformSms(phone, `${siteContent().brand.name}\nپیامک آزمایشی ✅`) };
  });
}

/* ============================ داشبورد، محتوا، تخفیف، اطلاع‌رسانی، گزارش ============================ */
export async function adminStatsAction() {
  return adminGuard((): PlatformStats => platformStats());
}
export async function adminContentAction() {
  return adminGuard((): SiteContent => siteContent());
}
export async function adminSaveContentAction(c: SiteContent) {
  return adminGuard(async () => { const out = saveSiteContent(c); await log("ویرایشِ محتوای سایت"); return out; });
}
export async function adminUploadLogoAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("عکسی انتخاب نشده");
    return { url: await savePlatformLogo(buf) };
  });
}
export async function adminUploadOgAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("عکسی انتخاب نشده");
    return { url: await savePlatformOgImage(buf) };
  });
}
export async function adminUploadCardImageAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("عکسی انتخاب نشده");
    return { url: await savePlatformCardImage(buf) };
  });
}
/* ---------- صفحه‌های شهری ---------- */
export async function adminCitiesAction() {
  return adminGuard((): City[] => listCities());
}
export async function adminSaveCityAction(c: City, prevSlug?: string) {
  return adminGuard(async () => { const saved = saveCity(c, prevSlug); await log(prevSlug ? "ویرایشِ صفحهٔ شهر" : "صفحهٔ شهرِ جدید", saved.slug, saved.name); return saved; });
}
export async function adminDeleteCityAction(slug: string) {
  return adminGuard(async () => { deleteCity(slug); await log("حذفِ صفحهٔ شهر", slug); return true; });
}

/* ---------- همکاران (معرف‌ها) ---------- */
export type AdminPartner = Partner & { stats: PartnerStats; link: string; dashboard: string };
export async function adminPartnersAction() {
  return adminGuard(async (): Promise<AdminPartner[]> => {
    const base = await platformUrl("");
    return listPartners().map((p) => ({ ...p, stats: partnerStats(p), link: `${base}/r/${p.code}`, dashboard: `${base}/partner/${p.token}` }));
  });
}
export async function adminSavePartnerAction(p: Partial<Partner> & { code: string }, prevCode?: string) {
  return adminGuard(async () => {
    const saved = savePartner(p, prevCode);
    await log(prevCode ? "ویرایشِ همکار" : "همکارِ جدید", saved.code, `${saved.name} · ${saved.percent}٪`);
    return saved.code;
  });
}
export async function adminDeletePartnerAction(code: string) {
  return adminGuard(async () => { deletePartner(code); await log("حذفِ همکار", code); return true; });
}
export async function adminPayoutAction(code: string, amount: number, note: string) {
  return adminGuard(async () => {
    if (!getPartner(code)) throw new Error("همکار پیدا نشد");
    addPayout(code, amount, note);
    await log("تسویهٔ پورسانتِ همکار", code, `${amount} تومان`);
    return true;
  });
}

/* ---------- منوی نمونهٔ زنده ---------- */
/** ساختِ مجموعهٔ «demo» با منوی نمونه که هیچ‌وقت منقضی نمی‌شود (برای دکمهٔ «منوی نمونه» در سایت) */
export async function adminCreateDemoAction(kind: BusinessKind = "cafe") {
  return adminGuard(async () => {
    const slug = "demo";
    let t = getTenant(slug);
    if (!t) {
      t = createTenant({
        slug, name: kind === "restaurant" ? "رستوران نمونه" : kind === "fastfood" ? "فست‌فود نمونه" : "کافه نمونه", kind,
        ownerName: "منوی نمونهٔ سایت", ownerPhone: "", password: crypto.randomBytes(18).toString("base64url"),
        sample: true, days: 36500, plan: "demo", note: "منوی نمونهٔ زندهٔ سایت (دکمهٔ «منوی نمونه»)", reserved: true,
      });
      await log("ساختِ منوی نمونه", slug);
    }
    const host = `${slug}.${rootDomain()}`;
    if ((await requestProto()) === "https" && process.env.AUTO_SSL === "1") await ensureCert(host);
    return { slug, url: await tenantUrl(t, "/?table=1") };
  });
}

/* ---------- مقاله‌ها ---------- */
export async function adminArticlesAction() {
  return adminGuard((): Article[] => listArticles());
}
export async function adminSaveArticleAction(a: Article, prevSlug?: string) {
  return adminGuard(async () => {
    const saved = saveArticle(a, prevSlug);
    await log(prevSlug ? "ویرایشِ مقاله" : "مقالهٔ جدید", saved.slug, saved.title);
    return saved;
  });
}
export async function adminDeleteArticleAction(slug: string) {
  return adminGuard(async () => { deleteArticle(slug); await log("حذفِ مقاله", slug); return true; });
}
export async function adminCouponsAction() {
  return adminGuard((): Coupon[] => listCoupons());
}
export async function adminSaveCouponAction(c: Partial<Coupon> & { code: string }) {
  return adminGuard(async () => { const code = saveCoupon(c); await log("ذخیرهٔ کدِ تخفیف", code, c.kind === "amount" ? `${c.value} تومان` : `${c.value}٪`); return { code }; });
}
export async function adminDeleteCouponAction(code: string) {
  return adminGuard(async () => { deleteCoupon(code); await log("حذفِ کدِ تخفیف", code); return { ok: true }; });
}
export interface NotifyData {
  notify: NotifySettings; announcement: Announcement; smsReady: boolean;
  reminders: ReturnType<typeof listReminders>; campaigns: ReturnType<typeof listOwnerSms>;
  audienceCounts: Record<OwnerAudience, number>;
}
export async function adminNotifyAction() {
  return adminGuard((): NotifyData => ({
    notify: notifySettings(), announcement: announcement(), smsReady: platformSmsReady(),
    reminders: listReminders(), campaigns: listOwnerSms(),
    audienceCounts: Object.fromEntries((["all", "active", "trial", "expired", "expiring"] as OwnerAudience[]).map((a) => [a, ownersFor(a).length])) as Record<OwnerAudience, number>,
  }));
}
export async function adminSaveNotifyAction(n: NotifySettings) {
  return adminGuard(async () => { saveNotifySettings(n); await log("تنظیمِ یادآوریِ تمدید", "", n.enabled ? "روشن" : "خاموش"); return { ok: true }; });
}
export async function adminRunRemindersAction() {
  return adminGuard(async () => runReminders(true));
}
export async function adminSaveAnnouncementAction(a: Announcement) {
  return adminGuard(async () => { saveAnnouncement(a); await log(a.enabled ? "انتشارِ اعلان در پنلِ مجموعه‌ها" : "برداشتنِ اعلان", "", a.text.slice(0, 80)); return { ok: true }; });
}
export async function adminOwnerSmsAction(message: string, audience: OwnerAudience, only?: string) {
  return adminGuard(async () => {
    const r = startOwnerSms(message, audience, only);
    await log("پیامک به صاحبانِ مجموعه‌ها", only || audience, `${r.total} گیرنده · ${message.slice(0, 60)}`);
    return r;
  });
}
export async function adminAuditAction(q = "") {
  return adminGuard((): AuditRow[] => listAudit(400, q));
}

/** شماره‌های مشتریانِ همهٔ مجموعه‌ها (یا یک مجموعه) — مشاهده و خروجی در گزارشِ فعالیت ثبت می‌شود */
export async function adminCustomersAction(slug = "") {
  return adminGuard(async (): Promise<{ rows: PlatformCustomer[]; perTenant: { slug: string; name: string; count: number }[] }> => {
    const r = allCustomers(slug);
    await log("مشاهدهٔ شماره‌های مشتریان", slug || "همه", `${r.rows.length} شماره`);
    return r;
  });
}
export async function adminCustomersExportAction(slug: string, count: number) {
  return adminGuard(async () => { await log("خروجیِ اکسلِ شماره‌های مشتریان", slug || "همه", `${count} شماره`); return { ok: true }; });
}
