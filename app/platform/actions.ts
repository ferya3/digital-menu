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
import { formatMoney, roundMoney, setPlatformCurrency } from "@/lib/utils";
import type { SiteContent } from "@/lib/site-content";
import type { Article } from "@/lib/articles";
import type { City } from "@/lib/cities";
import { REF_COOKIE, activeRef, addPayout, deletePartner, getPartner, listPartners, partnerStats, savePartner, type Partner, type PartnerStats } from "@/lib/partners";

/** Pass the error message through to the browser (Next hides server action error messages in production) */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    await assertPlatformHost();
    return await fn();
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
/** Platform actions run only on the root domain (not on venue subdomains) */
async function assertPlatformHost() {
  if (!saasEnabled()) throw new Error("Multi-tenant mode is not enabled");
  if (classifyHost((await requestHost()).host).kind !== "platform") throw new Error("Access denied");
}
/* Rate limits and codes live on disk (lib/limits) — they survive restarts */
const limit = (key: string, max: number, windowMs: number) => hit("pf:" + key, max, windowMs);

/* ============================ Signup ============================ */
export async function checkSlugAction(raw: string): Promise<{ ok: boolean; slug: string; message: string }> {
  try {
    await assertPlatformHost();
    const slug = validateSlug(raw);
    return slugAvailable(slug) ? { ok: true, slug, message: "This address is available ✓" } : { ok: false, slug, message: "This address is already taken" };
  } catch (e) {
    return { ok: false, slug: "", message: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function signupOtpAction(rawPhone: string) {
  return guard(async () => {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("Invalid phone number — include the country code, e.g. +1 555 123 4567");
    if (!platformSmsReady()) return { ok: true, required: false };
    limit("otp-ip:" + (await clientIp()), 5, 10 * 60_000);
    limit("otp-phone:" + phone, 3, 10 * 60_000);
    const code = issueCode("pf-signup:" + phone, 5 * 60_000);
    await sendPlatformSms(phone, `${siteContent().brand.name}: your signup verification code is ${code}`).catch(() => {
      throw new Error("Could not send the SMS — please try again in a moment");
    });
    return { ok: true, required: true };
  });
}

export interface SignupInput {
  name: string; kind: BusinessKind; slug: string; ownerName: string; phone: string;
  password: string; code?: string; sample: boolean; website?: string;
  /** Referring partner code (optional; falls back to the partner link cookie) */
  ref?: string;
}
/** Create a venue + free trial; returns an auto-login link to the venue dashboard */
export async function signupAction(input: SignupInput) {
  return guard(async () => {
    const ps = platformSettings();
    if (!ps.allowSignup) throw new Error("Online signup is currently closed — please contact support");
    if (input.website) throw new Error("Invalid request"); // bot trap (hidden field)
    limit("signup:" + (await clientIp()), 5, 60 * 60_000);
    const phone = normalizePhone(input.phone);
    if (!isValidPhone(phone)) throw new Error("Invalid phone number — include the country code, e.g. +1 555 123 4567");
    if (platformSmsReady()) checkCode("pf-signup:" + phone, String(input.code || "").replace(/\D/g, ""));
    const t = createTenant({
      slug: input.slug, name: input.name, kind: input.kind, ownerName: input.ownerName, ownerPhone: phone,
      password: input.password, sample: input.sample,
      ref: activeRef(input.ref) || activeRef((await cookies()).get(REF_COOKIE)?.value),
    });
    audit(input.ownerName || phone, "Venue signed up online", t.slug, `${t.name} · ${phone}`, await clientIp());
    return { ...(await enterLink(t)), slug: t.slug, trialDays: ps.trialDays };
  });
}

/** One-time login link to a venue dashboard (after signup and for "Open dashboard" in the admin panel) */
async function enterLink(t: Tenant): Promise<{ url: string; host: string }> {
  const host = t.domain || `${t.slug}.${rootDomain()}`;
  // On a real server an HTTPS certificate is issued for the new subdomain (a few seconds); falls back to http if that fails
  let url = await tenantUrl(t, "/staff/enter?t=" + encodeURIComponent(signPlatform({ slug: t.slug, p: "enter" }, 5 * 60_000)));
  if ((await requestProto()) === "https" && process.env.AUTO_SSL === "1" && !(await ensureCert(host))) url = url.replace(/^https:/, "http:");
  return { url, host };
}

export async function findPanelAction(raw: string) {
  return guard(async () => {
    limit("find:" + (await clientIp()), 30, 10 * 60_000);
    const slug = String(raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0];
    const t = slug && getTenant(slug);
    if (!t) throw new Error("No venue found at this address");
    return { url: await tenantUrl(t, "/staff") };
  });
}

/* ============================ Super admin ============================ */
const SECRET_MASK = "••••";
const maskSecret = (v: string) => (v ? `${SECRET_MASK}${v.slice(-4)}` : "");
const keepSecret = (incoming: string | undefined, current: string) => (incoming === undefined || incoming.startsWith(SECRET_MASK) ? current : incoming.trim());

/** Amount in the platform currency (for activity log details) */
const fmtAmount = (n: number) => formatMoney(n, platformSettings().currency);

const ADMIN_COOKIE = "platform_admin";
async function isPlatformAdmin(): Promise<boolean> {
  const d = verifyPlatform<{ r: string }>((await cookies()).get(ADMIN_COOKIE)?.value);
  return d?.r === "admin";
}
/** Record a super-admin action in the activity log */
async function log(action: string, target = "", detail = "") {
  audit("Super admin", action, target, detail, await clientIp());
}
async function adminGuard<T>(fn: () => Promise<T> | T) {
  return guard(async () => {
    if (!(await isPlatformAdmin())) throw new Error("Please log in first");
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
    if (!platformAdminConfigured()) throw new Error("The admin password is not set (PLATFORM_ADMIN_PASSWORD on the server)");
    assertNotLocked("pf:admin-login:" + (await clientIp()), 8, 15 * 60_000);
    assertNotLocked("pf:admin-login", 30, 15 * 60_000);
    if (!checkPlatformAdmin(password)) {
      // Only failed attempts count: 8 per 15 minutes per IP, 30 overall
      limit("admin-login:" + (await clientIp()), 8, 15 * 60_000);
      limit("admin-login", 30, 15 * 60_000);
      audit("Anonymous", "Failed admin login", "", "", await clientIp());
      throw new Error("Incorrect password");
    }
    (await cookies()).set(ADMIN_COOKIE, signPlatform({ r: "admin" }, 12 * 3600_000), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 3600, secure: (await requestProto()) === "https",
    });
    await log("Admin login");
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
    const ps = platformSettings();
    // Secrets are masked for the browser; saving a masked value keeps the stored one
    return { root: rootDomain(), tenants, payments, settings: { ...ps, stripe: { secretKey: maskSecret(ps.stripe.secretKey) }, sms: { ...ps.sms, authToken: maskSecret(ps.sms.authToken) } } };
  });
}

export async function adminCreateTenantAction(input: { slug: string; name: string; kind: BusinessKind; ownerName: string; phone: string; password: string; months: number; sample: boolean }) {
  return adminGuard(async () => {
    const phone = input.phone ? normalizePhone(input.phone) : "";
    if (phone && !isValidPhone(phone)) throw new Error("Invalid phone number — include the country code, e.g. +1 555 123 4567");
    const months = Math.max(0, Math.round(Number(input.months) || 0));
    const t = createTenant({
      slug: input.slug, name: input.name, kind: input.kind, ownerName: input.ownerName, ownerPhone: phone, password: input.password,
      sample: input.sample, days: months ? 0 : platformSettings().trialDays, plan: months ? "manual" : "trial", note: "Created by admin",
    });
    if (months) extendTenant(t.slug, months, "manual");
    await log("Venue created", t.slug, `${t.name}${months ? ` · ${months} mo` : " · trial"}`);
    return { slug: t.slug };
  });
}

export async function adminUpdateTenantAction(slug: string, patch: { name?: string; ownerName?: string; ownerPhone?: string; status?: "active" | "suspended"; domain?: string; note?: string; kind?: BusinessKind }) {
  return adminGuard(async () => {
    if (patch.ownerPhone !== undefined && patch.ownerPhone) {
      patch.ownerPhone = normalizePhone(patch.ownerPhone);
      if (!isValidPhone(patch.ownerPhone)) throw new Error("Invalid phone number — include the country code, e.g. +1 555 123 4567");
    }
    const t = updateTenant(slug, patch);
    if (patch.domain) void ensureCert(t.domain);
    await log(patch.status ? (patch.status === "suspended" ? "Venue suspended" : "Venue reactivated") : "Venue updated", slug, Object.keys(patch).join(", "));
    return { ok: true };
  });
}
/** Manual extension (months/days; negative days = subtract) or set the expiry date directly */
export async function adminExtendAction(slug: string, opts: { months?: number; days?: number; until?: string; amount?: number }) {
  return adminGuard(async () => {
    const t = getTenant(slug);
    if (!t) throw new Error("Venue not found");
    if (opts.until) {
      const d = new Date(opts.until);
      if (isNaN(+d)) throw new Error("Invalid date");
      updateTenant(slug, { expiresAt: d.toISOString(), plan: t.plan === "trial" ? "manual" : t.plan });
    } else if (opts.months && opts.months > 0) {
      // Also recorded in payment history; markPaymentPaid extends the subscription itself
      const amount = Math.max(0, roundMoney(Number(opts.amount) || 0));
      const p = createPayment({ slug, plan: { id: "manual", title: "Manual", months: Math.round(opts.months), price: amount }, method: "manual", note: amount ? "In-person payment (recorded by admin)" : "Extended by admin" });
      markPaymentPaid(p.id);
    } else if (opts.days && opts.days > 0) {
      extendTenant(slug, 0, t.plan, Math.round(opts.days)); // from today or the current expiry (whichever is later)
    } else if (opts.days) {
      updateTenant(slug, { expiresAt: new Date(+new Date(t.expiresAt) + Math.round(opts.days) * 86_400_000).toISOString() });
    }
    await log("Subscription changed", slug, opts.until ? `until ${opts.until}` : opts.months ? `+${opts.months} mo${opts.amount ? ` · ${fmtAmount(opts.amount)}` : ""}` : `${opts.days} days`);
    return { ok: true };
  });
}
export async function adminResetPasswordAction(slug: string) {
  return adminGuard(async () => {
    if (!getTenant(slug)) throw new Error("Venue not found");
    const pw = crypto.randomBytes(5).toString("hex");
    runAsTenant(slug, () => setSetting("admin_pw", hashPassword(pw)));
    await log("Venue password reset", slug);
    return { password: pw };
  });
}
export async function adminEnterAction(slug: string) {
  return adminGuard(async () => {
    const t = getTenant(slug);
    if (!t) throw new Error("Venue not found");
    await log("Opened venue dashboard", slug);
    return enterLink(t);
  });
}
export async function adminDeleteTenantAction(slug: string, confirmSlug: string) {
  return adminGuard(async () => {
    if (slug !== confirmSlug) throw new Error("To delete, type the venue address exactly");
    deleteTenant(slug);
    await log("Venue deleted", slug);
    return { ok: true };
  });
}
export async function adminPaymentAction(id: string, approve: boolean, note = "") {
  return adminGuard(async () => {
    const p = getPayment(id);
    if (!p || p.status !== "pending") throw new Error("This payment is not awaiting review");
    if (approve) markPaymentPaid(id, "", note || "Receipt approved by admin");
    else markPaymentFailed(id, "rejected", note || "Receipt rejected");
    await log(approve ? "Receipt approved" : "Receipt rejected", p.slug, `${fmtAmount(p.amount)}${note ? ` · ${note}` : ""}`);
    return { ok: true };
  });
}
export async function adminSaveSettingsAction(s: PlatformSettings) {
  return adminGuard(async () => {
    const cur = platformSettings();
    const key = keepSecret(s.stripe?.secretKey, cur.stripe.secretKey);
    if (key && !/^(sk|rk)_(test|live)_/.test(key)) throw new Error("The Stripe secret key should start with sk_live_ or sk_test_");
    savePlatformSettings({
      ...s,
      stripe: { secretKey: key },
      sms: { ...cur.sms, ...s.sms, provider: s.sms?.provider === "twilio" ? "twilio" : "none", authToken: keepSecret(s.sms?.authToken, cur.sms.authToken) },
    });
    setPlatformCurrency(platformSettings().currency);
    await log("Platform settings saved");
    return { ok: true };
  });
}
export async function adminSetPasswordAction(pw: string) {
  return adminGuard(async () => { setPlatformAdminPassword(pw); await log("Admin password changed"); return { ok: true }; });
}
export async function adminTestSmsAction(rawPhone: string) {
  return adminGuard(async () => {
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("Invalid phone number — include the country code, e.g. +1 555 123 4567");
    return { detail: await sendPlatformSms(phone, `${siteContent().brand.name}: test SMS ✅`) };
  });
}

/* ============================ Dashboard, content, coupons, notifications, logs ============================ */
export async function adminStatsAction() {
  return adminGuard((): PlatformStats => platformStats());
}
export async function adminContentAction() {
  return adminGuard((): SiteContent => siteContent());
}
export async function adminSaveContentAction(c: SiteContent) {
  return adminGuard(async () => { const out = saveSiteContent(c); await log("Site content updated"); return out; });
}
export async function adminUploadLogoAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("No image selected");
    return { url: await savePlatformLogo(buf) };
  });
}
export async function adminUploadOgAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("No image selected");
    return { url: await savePlatformOgImage(buf) };
  });
}
export async function adminUploadCardImageAction(fd: FormData) {
  return adminGuard(async () => {
    const buf = await readUpload(fd);
    if (!buf) throw new Error("No image selected");
    return { url: await savePlatformCardImage(buf) };
  });
}
/* ---------- City pages ---------- */
export async function adminCitiesAction() {
  return adminGuard((): City[] => listCities());
}
export async function adminSaveCityAction(c: City, prevSlug?: string) {
  return adminGuard(async () => { const saved = saveCity(c, prevSlug); await log(prevSlug ? "City page updated" : "City page created", saved.slug, saved.name); return saved; });
}
export async function adminDeleteCityAction(slug: string) {
  return adminGuard(async () => { deleteCity(slug); await log("City page deleted", slug); return true; });
}

/* ---------- Partners (referrers) ---------- */
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
    await log(prevCode ? "Partner updated" : "Partner created", saved.code, `${saved.name} · ${saved.percent}%`);
    return saved.code;
  });
}
export async function adminDeletePartnerAction(code: string) {
  return adminGuard(async () => { deletePartner(code); await log("Partner deleted", code); return true; });
}
export async function adminPayoutAction(code: string, amount: number, note: string) {
  return adminGuard(async () => {
    if (!getPartner(code)) throw new Error("Partner not found");
    addPayout(code, amount, note);
    await log("Partner payout", code, fmtAmount(amount));
    return true;
  });
}

/* ---------- Live demo menu ---------- */
/** Create the never-expiring "demo" venue with a sample menu (for the site's "Live demo" button) */
export async function adminCreateDemoAction(kind: BusinessKind = "cafe") {
  return adminGuard(async () => {
    const slug = "demo";
    let t = getTenant(slug);
    if (!t) {
      t = createTenant({
        slug, name: kind === "restaurant" ? "Demo Restaurant" : kind === "fastfood" ? "Demo Burger Bar" : "Demo Café", kind,
        ownerName: "Website demo menu", ownerPhone: "", password: crypto.randomBytes(18).toString("base64url"),
        sample: true, days: 36500, plan: "demo", note: "Live demo menu for the website (\"Live demo\" button)", reserved: true,
      });
      await log("Demo menu created", slug);
    }
    const host = `${slug}.${rootDomain()}`;
    if ((await requestProto()) === "https" && process.env.AUTO_SSL === "1") await ensureCert(host);
    return { slug, url: await tenantUrl(t, "/?table=1") };
  });
}

/* ---------- Articles ---------- */
export async function adminArticlesAction() {
  return adminGuard((): Article[] => listArticles());
}
export async function adminSaveArticleAction(a: Article, prevSlug?: string) {
  return adminGuard(async () => {
    const saved = saveArticle(a, prevSlug);
    await log(prevSlug ? "Article updated" : "Article created", saved.slug, saved.title);
    return saved;
  });
}
export async function adminDeleteArticleAction(slug: string) {
  return adminGuard(async () => { deleteArticle(slug); await log("Article deleted", slug); return true; });
}
export async function adminCouponsAction() {
  return adminGuard((): Coupon[] => listCoupons());
}
export async function adminSaveCouponAction(c: Partial<Coupon> & { code: string }) {
  return adminGuard(async () => { const code = saveCoupon(c); await log("Coupon saved", code, c.kind === "amount" ? fmtAmount(Number(c.value) || 0) : `${c.value}%`); return { code }; });
}
export async function adminDeleteCouponAction(code: string) {
  return adminGuard(async () => { deleteCoupon(code); await log("Coupon deleted", code); return { ok: true }; });
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
  return adminGuard(async () => { saveNotifySettings(n); await log("Renewal reminders updated", "", n.enabled ? "on" : "off"); return { ok: true }; });
}
export async function adminRunRemindersAction() {
  return adminGuard(async () => runReminders(true));
}
export async function adminSaveAnnouncementAction(a: Announcement) {
  return adminGuard(async () => { saveAnnouncement(a); await log(a.enabled ? "Announcement published" : "Announcement removed", "", a.text.slice(0, 80)); return { ok: true }; });
}
export async function adminOwnerSmsAction(message: string, audience: OwnerAudience, only?: string) {
  return adminGuard(async () => {
    const r = startOwnerSms(message, audience, only);
    await log("SMS to venue owners", only || audience, `${r.total} recipients · ${message.slice(0, 60)}`);
    return r;
  });
}
export async function adminAuditAction(q = "") {
  return adminGuard((): AuditRow[] => listAudit(400, q));
}

/** Customer phone numbers across all venues (or one venue) — viewing and exporting are logged */
export async function adminCustomersAction(slug = "") {
  return adminGuard(async (): Promise<{ rows: PlatformCustomer[]; perTenant: { slug: string; name: string; count: number }[] }> => {
    const r = allCustomers(slug);
    await log("Viewed customer numbers", slug || "all", `${r.rows.length} numbers`);
    return r;
  });
}
export async function adminCustomersExportAction(slug: string, count: number) {
  return adminGuard(async () => { await log("Exported customer numbers (CSV)", slug || "all", `${count} numbers`); return { ok: true }; });
}
