"use server";

import { DEMO_MESSAGE, demoFail, demoMode } from "@/lib/demo";
import {
  checkAdmin,
  isAuthed,
  needsPasswordChange,
  startSession,
  endSession,
  setAdminPassword,
} from "@/lib/auth";
import {
  listOrders,
  listRequests,
  markRequestDone,
  listFeedback,
  listCustomers,
  setSmsOptOut,
  setOrderStatus,
  setPayStatus,
  setPaid,
  setTablePayStatus,
  settleTable,
  getMenu,
  getSetting,
  setSetting,
  addCategory,
  updateCategory,
  deleteCategory,
  addItem,
  updateItem,
  deleteItem,
  type StaffRequest,
  type StaffFeedback,
  type StaffCustomer,
} from "@/lib/queries";
import { saveImageWebp, readUpload } from "@/lib/images";
import { DEFAULT_SMS, isValidPhone, normalizePhone, sendTestSms } from "@/lib/otp";
import { getAccounting, type Accounting } from "@/lib/accounting";
import { startCampaign, listCampaigns, controlCampaign, sendSmsText, CANCEL_FOOTER, type Campaign } from "@/lib/bulk-sms";
import type { ActionFail } from "@/lib/action-result";
import { withTenant } from "@/lib/tenant";
import { currentTenant } from "@/lib/tenant-context";
import { assertNotLocked, clearHits, hit } from "@/lib/limits";
import { clientIp } from "@/lib/security";
import type { CafeInfo, Menu, Order, OrderCodeMode, OrderStatus, PaymentInfo, SmsSettings, StripeSettings } from "@/lib/types";

const DEFAULT_CAFE: CafeInfo = { name: "My Café", logo: "☕", tagline: "", currency: "USD" };
const DEFAULT_PAYMENT: PaymentInfo = { card: "", holder: "", note: "", link: "" };
const DEFAULT_STRIPE: StripeSettings = { enabled: false, secretKey: "" };

/** Secrets are never sent back to the browser in full; a masked value means "unchanged" */
const MASK = "••••";
const mask = (v: string) => (v ? `${MASK}${v.slice(-4)}` : "");
const keep = (incoming: string | undefined, current: string) => (incoming === undefined || incoming.startsWith(MASK) ? current : incoming.trim());

/** Returns the error (with a readable message); throwing in production would hide the message */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    // Each action runs in the venue context of this request (subdomain)
    return await withTenant(fn);
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "Error" };
  }
}

async function gate() {
  if (!(await isAuthed())) throw new Error("Not authorized — please sign in first");
}

/* ---------- auth ---------- */
export async function loginAction(password: string): Promise<{ ok: boolean; mustChange: boolean } | ActionFail> {
  return guard(async () => {
  // Password guessing: at most 10 failed attempts per 15 minutes per IP (and 50 per venue)
  const ip = await clientIp(), slug = currentTenant().slug;
  const LOCK = "Too many attempts — please try again in 15 minutes";
  // Lock is checked before the password: while locked even the right password is refused (guessing is pointless)
  assertNotLocked(`login:${slug}:${ip}`, 10, 15 * 60_000, LOCK);
  assertNotLocked(`login:${slug}`, 100, 15 * 60_000, LOCK);
  const res = checkAdmin(String(password || ""));
  if (!res.ok) {
    hit(`login:${slug}:${ip}`, 10, 15 * 60_000, LOCK);
    hit(`login:${slug}`, 100, 15 * 60_000, LOCK);
    throw new Error("Incorrect password");
  }
  clearHits(`login:${slug}:${ip}`);
  await startSession(res.mustChange);
  return { ok: true, mustChange: res.mustChange };
  });
}
/** Replace a weak/default password (first sign-in) — the panel opens afterwards */
export async function staffChangePasswordAction(newPassword: string): Promise<{ ok: boolean } | ActionFail> {
  if (demoMode()) return demoFail();
  return guard(async () => {
  if (!(await needsPasswordChange()) && !(await isAuthed())) throw new Error("Please sign in first");
  setAdminPassword(String(newPassword || "").trim());
  await startSession(false);
  return { ok: true };
  });
}
export async function logoutAction(): Promise<{ ok: boolean }> {
  return withTenant(async () => {
    await endSession();
    return { ok: true };
  });
}

/* ---------- orders / cashier ---------- */
export async function staffOrdersAction(): Promise<Order[]> {
  return withTenant(async () => {
    await gate();
    return listOrders();
  });
}
export async function staffSetStatusAction(id: string, status: OrderStatus): Promise<Order | null | ActionFail> {
  return guard(async () => {
  await gate();
  return setOrderStatus(id, status);
  });
}
export async function staffConfirmPayAction(id: string): Promise<Order | null> {
  return withTenant(async () => {
    await gate();
    return setPayStatus(id, "confirmed");
  });
}
export async function staffRejectPayAction(id: string, reason: string): Promise<Order | null> {
  return withTenant(async () => {
    await gate();
    return setPayStatus(id, "rejected", reason);
  });
}
/** Manually mark one order as paid */
export async function staffSetPaidAction(id: string, paid: boolean): Promise<Order | null> {
  return withTenant(async () => {
    await gate();
    return setPaid(id, paid);
  });
}
/** Settle a table's whole bill (card reader/cash) */
export async function staffSettleTableAction(table: string): Promise<{ count: number }> {
  return withTenant(async () => {
    await gate();
    return { count: settleTable(table) };
  });
}
/** Cashier: approve or reject the receipt for a table's whole bill */
export async function staffTablePayAction(table: string, pay: "confirmed" | "rejected", reason = ""): Promise<{ count: number }> {
  return withTenant(async () => {
    await gate();
    return { count: setTablePayStatus(table, pay, reason) };
  });
}

/* ---------- requests / feedback / customers ---------- */
export async function staffRequestsAction(): Promise<StaffRequest[]> {
  return withTenant(async () => {
    await gate();
    return listRequests();
  });
}
export async function staffDoneRequestAction(id: string): Promise<{ ok: boolean }> {
  return withTenant(async () => {
    await gate();
    return markRequestDone(id);
  });
}
export async function staffFeedbackAction(): Promise<StaffFeedback[]> {
  return withTenant(async () => {
    await gate();
    return listFeedback();
  });
}
export async function staffCustomersAction(): Promise<StaffCustomer[]> {
  return withTenant(async () => {
    await gate();
    return listCustomers();
  });
}

/* ---------- menu management ---------- */
export async function staffMenuAction(): Promise<Menu> {
  return withTenant(async () => {
    await gate();
    return getMenu();
  });
}
/** Add/edit a category; the icon can be an emoji or an uploaded image */
export async function staffSaveCategoryAction(input: { id?: string; name: string; emoji?: string }, iconForm?: FormData | null) {
  if (demoMode()) return demoFail();
  return guard(async () => {
  return saveCategory(input, iconForm);
  });
}
/** Full-width category promo banner: upload (FormData) or remove (null) */
export async function staffCategoryBannerAction(id: string, bannerForm: FormData | null) {
  if (demoMode()) return demoFail();
  return guard(async () => {
  await gate();
  const buf = await readUpload(bannerForm);
  const banner = buf ? await saveImageWebp(buf, "banner", 1800) : "";
  updateCategory(id, { banner });
  return { banner };
  });
}
async function saveCategory(input: { id?: string; name: string; emoji?: string }, iconForm?: FormData | null) {
  await gate();
  if (!input.name?.trim()) throw new Error("Enter a category name");
  const buf = await readUpload(iconForm);
  const emoji = buf ? await saveImageWebp(buf, "cat", 240) : input.emoji?.trim() || "🍽️";
  if (input.id) {
    updateCategory(input.id, { name: input.name, emoji });
    return { id: input.id };
  }
  return addCategory({ name: input.name, emoji });
}
export async function staffDeleteCategoryAction(id: string) {
  if (demoMode()) return demoFail();
  return guard(async () => {
  await gate();
  return deleteCategory(id);
  });
}
export async function staffSaveItemAction(input: {
  id?: string;
  name: string;
  categoryId: string;
  description?: string;
  price?: number;
  oldPrice?: number;
  emoji?: string;
  image?: string; // "" removes the image
  tag?: string;
  available?: boolean;
  /** Create a new category together with the item */
  newCategory?: { name: string; emoji?: string };
}, imageForm?: FormData | null) {
  if (demoMode()) return demoFail();
  return guard(async () => {
  await gate();
  if (!input.name?.trim()) throw new Error("Enter an item name");
  if (input.newCategory) {
    if (!input.newCategory.name?.trim()) throw new Error("Enter a name for the new category");
    input = { ...input, categoryId: addCategory(input.newCategory).id };
  }
  delete input.newCategory;
  const buf = await readUpload(imageForm);
  const image = buf ? await saveImageWebp(buf, "item") : input.image;
  const payload: Record<string, unknown> = { ...input };
  if (image !== undefined) payload.image = image;
  else delete payload.image;
  if (input.id) {
    updateItem(input.id, payload);
    return { id: input.id };
  }
  return addItem(payload as Parameters<typeof addItem>[0]);
  });
}
/** Quick price edit from the list */
export async function staffQuickPriceAction(id: string, price: number) {
  if (demoMode()) return demoFail();
  return withTenant(async () => {
    await gate();
    return updateItem(id, { price });
  });
}
export async function staffDeleteItemAction(id: string) {
  if (demoMode()) return demoFail();
  return withTenant(async () => {
    await gate();
    return deleteItem(id);
  });
}

/* ---------- settings ---------- */
export interface AdminSettings {
  cafe: CafeInfo;
  payment: PaymentInfo;
  orderCode: OrderCodeMode;
  sms: SmsSettings;
  /** Online card payments for table bills (secret key is masked) */
  stripe: StripeSettings;
  /** Orders go to the kitchen only after payment is confirmed */
  payFirst: boolean;
  hasPassword: boolean;
}
export async function staffSettingsAction(): Promise<AdminSettings> {
  return withTenant(async () => {
    await gate();
    return {
      cafe: { address: "", mapUrl: "", instagram: "", ...getSetting<CafeInfo>("cafe", DEFAULT_CAFE) },
      payment: { ...DEFAULT_PAYMENT, ...getSetting<PaymentInfo>("payment", DEFAULT_PAYMENT) },
      orderCode: getSetting<OrderCodeMode>("orderCode", "number"),
      ...(() => {
        const sms = { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) };
        const stripe = { ...DEFAULT_STRIPE, ...getSetting<Partial<StripeSettings>>("stripe", {}) };
        return { sms: { ...sms, authToken: mask(sms.authToken) }, stripe: { ...stripe, secretKey: mask(stripe.secretKey) } };
      })(),
      payFirst: getSetting<boolean>("payFirst", true) !== false,
      hasPassword: !!getSetting<string>("admin_pw", ""),
    };
  });
}
export async function staffUpdateSettingsAction(input: {
  cafe?: Partial<CafeInfo>;
  payment?: Partial<PaymentInfo>;
  orderCode?: OrderCodeMode;
  sms?: Partial<SmsSettings>;
  stripe?: Partial<StripeSettings>;
  payFirst?: boolean;
  newPassword?: string;
}, logoForm?: FormData | null): Promise<{ ok: boolean } | ActionFail> {
  if (demoMode()) return demoFail();
  return guard(async () => {
  await gate();
  const logoBuf = await readUpload(logoForm);
  if (input.cafe || logoBuf) {
    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    if (input.cafe?.currency !== undefined && !/^[A-Z]{3}$/.test(input.cafe.currency)) throw new Error("Currency must be a 3-letter ISO code, e.g. USD");
    if (input.cafe?.timezone) { try { new Intl.DateTimeFormat("en-US", { timeZone: input.cafe.timezone }); } catch { throw new Error("Unknown time zone"); } }
    let logo = input.cafe?.logo ?? cur.logo;
    if (logoBuf) logo = await saveImageWebp(logoBuf, "logo", 512);
    // The hero video only changes through its own upload route
    const next = { ...cur, ...input.cafe, logo, heroVideo: cur.heroVideo, heroPoster: cur.heroPoster };
    // Keep SEO fields short
    for (const [k, n] of [["city", 40], ["phone", 20], ["seoDescription", 160]] as const) if (next[k]) next[k] = String(next[k]).slice(0, n);
    setSetting("cafe", next);
  }
  if (input.payment) {
    setSetting("payment", { ...DEFAULT_PAYMENT, ...getSetting<PaymentInfo>("payment", DEFAULT_PAYMENT), ...input.payment });
  }
  if (input.orderCode === "number" || input.orderCode === "id") setSetting("orderCode", input.orderCode);
  if (input.sms) {
    const cur = { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) };
    const next: SmsSettings = {
      provider: input.sms.provider === "twilio" ? "twilio" : input.sms.provider === "none" ? "none" : cur.provider,
      accountSid: String(input.sms.accountSid ?? cur.accountSid).trim(),
      authToken: keep(input.sms.authToken, cur.authToken),
      from: String(input.sms.from ?? cur.from).trim(),
      otpEnabled: input.sms.otpEnabled === undefined ? cur.otpEnabled : !!input.sms.otpEnabled,
    };
    setSetting("sms", next);
  }
  if (input.stripe) {
    const cur = { ...DEFAULT_STRIPE, ...getSetting<Partial<StripeSettings>>("stripe", {}) };
    const secretKey = keep(input.stripe.secretKey, cur.secretKey);
    if (secretKey && !/^(sk|rk)_(test|live)_/.test(secretKey)) throw new Error("The Stripe secret key should start with sk_live_ or sk_test_");
    setSetting("stripe", { enabled: input.stripe.enabled === undefined ? cur.enabled : !!input.stripe.enabled, secretKey });
  }
  if (typeof input.payFirst === "boolean") setSetting("payFirst", input.payFirst);
  if (input.newPassword && input.newPassword.trim()) {
    setAdminPassword(input.newPassword.trim());
  }
  return { ok: true };
  });
}

/** Send a test SMS (after saving settings) */
export async function staffTestSmsAction(phone: string): Promise<{ ok: boolean; detail: string }> {
  if (demoMode()) return { ok: false, detail: DEMO_MESSAGE };
  return withTenant(async () => {
    await gate();
    try {
      return { ok: true, detail: await sendTestSms(phone) };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "Error" };
    }
  });
}

/* ---------- Bulk SMS ---------- */
export async function staffSetOptOutAction(phone: string, optOut: boolean) {
  if (demoMode()) return demoFail();
  return guard(async () => { await gate(); return setSmsOptOut(phone, optOut); });
}
/** Start sending to the selected numbers (registered, subscribed customers only) */
export async function staffStartSmsCampaignAction(input: { message: string; phones: string[]; addCancel: boolean }) {
  if (demoMode()) return demoFail();
  return guard(async () => { await gate(); return startCampaign(input.message, input.phones, input.addCancel); });
}
export async function staffSmsCampaignsAction(): Promise<Campaign[]> {
  return withTenant(async () => {
    await gate();
    return listCampaigns();
  });
}
export async function staffSmsControlAction(id: string, action: "resume" | "retry" | "cancel") {
  if (demoMode()) return demoFail();
  return guard(async () => { await gate(); return controlCampaign(id, action); });
}
/** Send the same text to one number (e.g. the manager's phone) before the bulk send */
export async function staffSmsPreviewAction(rawPhone: string, message: string, addCancel: boolean) {
  return guard(async () => {
    await gate();
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("Enter a valid phone number in international format (e.g. +1 555 123 4567)");
    const text = addCancel && !message.includes(CANCEL_FOOTER) ? `${message.trim()}\n${CANCEL_FOOTER}` : message.trim();
    if (!text) throw new Error("Write the message text");
    return { detail: await sendSmsText(phone, text) };
  });
}

/* ---------- Accounting ---------- */
export async function staffAccountingAction(month?: string): Promise<Accounting> {
  return withTenant(async () => {
    await gate();
    return getAccounting(month);
  });
}

/* ---------- QR ---------- */
export async function staffTableUrlAction(table: number): Promise<string> {
  return withTenant(async () => {
    return `/?table=${table}`;
  });
}
