"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { assertNotLocked, checkCode, hit, issueCode } from "@/lib/limits";
import { clientIp } from "@/lib/security";
import { saasEnabled, rootDomain } from "@/lib/tenant-context";
import { classifyHost, requestHost, requestProto, tenantUrl } from "@/lib/tenant";
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
    await sendPlatformSms(phone, `${platformSettings().brand}\nکد تأیید ثبت‌نام: ${code}`).catch(() => {
      throw new Error("ارسال پیامک انجام نشد؛ کمی بعد دوباره تلاش کنید");
    });
    return { ok: true, required: true };
  });
}

export interface SignupInput {
  name: string; kind: BusinessKind; slug: string; ownerName: string; phone: string;
  password: string; code?: string; sample: boolean; website?: string;
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
    });
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
      throw new Error("رمز اشتباه است");
    }
    (await cookies()).set(ADMIN_COOKIE, signPlatform({ r: "admin" }, 12 * 3600_000), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 3600, secure: (await requestProto()) === "https",
    });
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
  return adminGuard(() => {
    const phone = input.phone ? normalizePhone(input.phone) : "";
    if (phone && !isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    const months = Math.max(0, Math.round(Number(input.months) || 0));
    const t = createTenant({
      slug: input.slug, name: input.name, kind: input.kind, ownerName: input.ownerName, ownerPhone: phone, password: input.password,
      sample: input.sample, days: months ? 0 : platformSettings().trialDays, plan: months ? "manual" : "trial", note: "ساخته‌شده توسط مدیر",
    });
    if (months) extendTenant(t.slug, months, "manual");
    return { slug: t.slug };
  });
}

export async function adminUpdateTenantAction(slug: string, patch: { name?: string; ownerName?: string; ownerPhone?: string; status?: "active" | "suspended"; domain?: string; note?: string }) {
  return adminGuard(async () => {
    const t = updateTenant(slug, patch);
    if (patch.domain) void ensureCert(t.domain);
    return { ok: true };
  });
}
/** تمدیدِ دستی (ماه/روز؛ روزِ منفی = کم‌کردن) یا تعیینِ مستقیمِ تاریخِ انقضا */
export async function adminExtendAction(slug: string, opts: { months?: number; days?: number; until?: string }) {
  return adminGuard(() => {
    const t = getTenant(slug);
    if (!t) throw new Error("مجموعه پیدا نشد");
    if (opts.until) {
      const d = new Date(opts.until);
      if (isNaN(+d)) throw new Error("تاریخ نامعتبر است");
      updateTenant(slug, { expiresAt: d.toISOString(), plan: t.plan === "trial" ? "manual" : t.plan });
    } else if (opts.months && opts.months > 0) {
      // در تاریخچهٔ پرداخت‌ها هم ثبت می‌شود؛ markPaymentPaid خودش اشتراک را تمدید می‌کند
      const p = createPayment({ slug, plan: { id: "manual", title: "دستی", months: Math.round(opts.months), price: 0 }, method: "manual", note: "تمدید توسط مدیر" });
      markPaymentPaid(p.id);
    } else if (opts.days && opts.days > 0) {
      extendTenant(slug, 0, t.plan, Math.round(opts.days)); // از امروز یا از انقضای فعلی (هرکدام دیرتر)
    } else if (opts.days) {
      updateTenant(slug, { expiresAt: new Date(+new Date(t.expiresAt) + Math.round(opts.days) * 86_400_000).toISOString() });
    }
    return { ok: true };
  });
}
export async function adminResetPasswordAction(slug: string) {
  return adminGuard(() => {
    if (!getTenant(slug)) throw new Error("مجموعه پیدا نشد");
    const pw = crypto.randomBytes(5).toString("hex");
    runAsTenant(slug, () => setSetting("admin_pw", hashPassword(pw)));
    return { password: pw };
  });
}
export async function adminEnterAction(slug: string) {
  return adminGuard(async () => {
    const t = getTenant(slug);
    if (!t) throw new Error("مجموعه پیدا نشد");
    return enterLink(t);
  });
}
export async function adminDeleteTenantAction(slug: string, confirmSlug: string) {
  return adminGuard(() => {
    if (slug !== confirmSlug) throw new Error("برای حذف، آدرسِ مجموعه را دقیق وارد کنید");
    deleteTenant(slug);
    return { ok: true };
  });
}
export async function adminPaymentAction(id: string, approve: boolean, note = "") {
  return adminGuard(() => {
    const p = getPayment(id);
    if (!p || p.status !== "pending") throw new Error("این پرداخت در انتظارِ بررسی نیست");
    if (approve) markPaymentPaid(id, "", note || "تأیید فیش توسط مدیر");
    else markPaymentFailed(id, "rejected", note || "فیش تأیید نشد");
    return { ok: true };
  });
}
export async function adminSaveSettingsAction(s: PlatformSettings) {
  return adminGuard(() => { savePlatformSettings(s); return { ok: true }; });
}
export async function adminSetPasswordAction(pw: string) {
  return adminGuard(() => { setPlatformAdminPassword(pw); return { ok: true }; });
}
export async function adminTestSmsAction(rawPhone: string) {
  return adminGuard(async () => {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("شمارهٔ موبایل نامعتبر است");
    return { detail: await sendPlatformSms(phone, `${platformSettings().brand}\nپیامک آزمایشی ✅`) };
  });
}
