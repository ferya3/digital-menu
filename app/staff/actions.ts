"use server";

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
import type { CafeInfo, Gateway, Menu, Order, OrderCodeMode, OrderStatus, PaymentInfo, SmsSettings } from "@/lib/types";

const DEFAULT_CAFE: CafeInfo = { name: "کافه آرتاویل", logo: "☕", tagline: "", currency: "toman" };
const DEFAULT_PAYMENT: PaymentInfo = { card: "", holder: "", note: "", link: "" };
const DEFAULT_GATEWAYS: Gateway[] = [
  { id: "zarinpal", name: "زرین‌پال", enabled: false, config: { merchantId: "" } },
  { id: "mellat", name: "بانک ملت (به‌پرداخت ملت)", enabled: false, config: { terminalId: "", username: "", password: "" } },
  { id: "melli", name: "بانک ملی (سداد)", enabled: false, config: { merchantId: "", terminalId: "", key: "" } },
];
/** درگاه‌های ذخیره‌شده را با پیش‌فرض‌ها ادغام می‌کند تا هیچ‌کدام گم نشود */
function mergeGateways(saved: Gateway[] | undefined): Gateway[] {
  return DEFAULT_GATEWAYS.map((def) => {
    const f = (saved || []).find((g) => g.id === def.id);
    return f ? { ...def, enabled: !!f.enabled, config: { ...def.config, ...(f.config || {}) } } : structuredClone(def);
  });
}

/** خطا را (با پیامِ فارسی) برمی‌گرداند؛ پرتاب‌شدن در production پیام را پنهان می‌کند */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    // هر اکشن در زمینهٔ مجموعهٔ همین درخواست (زیردامنه) اجرا می‌شود
    return await withTenant(fn);
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "خطا" };
  }
}

async function gate() {
  if (!(await isAuthed())) throw new Error("دسترسی غیرمجاز — ابتدا وارد شوید");
}

/* ---------- auth ---------- */
export async function loginAction(password: string): Promise<{ ok: boolean; mustChange: boolean } | ActionFail> {
  return guard(async () => {
  // حدسِ رمز: حداکثر ۱۰ تلاشِ ناموفق در ۱۵ دقیقه برای هر IP (و ۵۰ برای کلِ مجموعه)
  const ip = await clientIp(), slug = currentTenant().slug;
  const LOCK = "تعداد تلاش زیاد است؛ ۱۵ دقیقه بعد دوباره امتحان کنید";
  // قفل قبل از بررسیِ رمز: در زمانِ قفل حتی رمزِ درست هم پذیرفته نمی‌شود (حدس‌زدن بی‌فایده است)
  assertNotLocked(`login:${slug}:${ip}`, 10, 15 * 60_000, LOCK);
  assertNotLocked(`login:${slug}`, 100, 15 * 60_000, LOCK);
  const res = checkAdmin(String(password || ""));
  if (!res.ok) {
    hit(`login:${slug}:${ip}`, 10, 15 * 60_000, LOCK);
    hit(`login:${slug}`, 100, 15 * 60_000, LOCK);
    throw new Error("رمز اشتباه است");
  }
  clearHits(`login:${slug}:${ip}`);
  await startSession(res.mustChange);
  return { ok: true, mustChange: res.mustChange };
  });
}
/** عوض‌کردنِ رمزِ ضعیف/پیش‌فرض (اولین ورود) — بعد از آن پنل باز می‌شود */
export async function staffChangePasswordAction(newPassword: string): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  if (!(await needsPasswordChange()) && !(await isAuthed())) throw new Error("ابتدا وارد شوید");
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
/** «پرداخت شد» دستی روی یک سفارش */
export async function staffSetPaidAction(id: string, paid: boolean): Promise<Order | null> {
  return withTenant(async () => {
    await gate();
    return setPaid(id, paid);
  });
}
/** تسویهٔ کل صورتحسابِ میز با کارت‌خوان/نقدی */
export async function staffSettleTableAction(table: string): Promise<{ count: number }> {
  return withTenant(async () => {
    await gate();
    return { count: settleTable(table) };
  });
}
/** صندوق: تأیید یا ردِ فیشِ کل صورتحسابِ یک میز */
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
/** افزودن/ویرایش دسته؛ آیکون می‌تواند ایموجی یا عکسِ آپلودی باشد */
export async function staffSaveCategoryAction(input: { id?: string; name: string; emoji?: string }, iconForm?: FormData | null) {
  return guard(async () => {
  return saveCategory(input, iconForm);
  });
}
/** بنرِ تبلیغاتیِ تمام‌عرضِ یک دسته: آپلود (FormData) یا حذف (null) */
export async function staffCategoryBannerAction(id: string, bannerForm: FormData | null) {
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
  if (!input.name?.trim()) throw new Error("نام دسته را وارد کنید");
  const buf = await readUpload(iconForm);
  const emoji = buf ? await saveImageWebp(buf, "cat", 240) : input.emoji?.trim() || "🍽️";
  if (input.id) {
    updateCategory(input.id, { name: input.name, emoji });
    return { id: input.id };
  }
  return addCategory({ name: input.name, emoji });
}
export async function staffDeleteCategoryAction(id: string) {
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
  image?: string; // "" یعنی حذفِ عکس
  tag?: string;
  available?: boolean;
  /** ساختِ دستهٔ جدید همراهِ محصول */
  newCategory?: { name: string; emoji?: string };
}, imageForm?: FormData | null) {
  return guard(async () => {
  await gate();
  if (!input.name?.trim()) throw new Error("نام محصول را وارد کنید");
  if (input.newCategory) {
    if (!input.newCategory.name?.trim()) throw new Error("نام دستهٔ جدید را وارد کنید");
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
/** ویرایش سریع قیمت از داخل لیست */
export async function staffQuickPriceAction(id: string, price: number) {
  return withTenant(async () => {
    await gate();
    return updateItem(id, { price });
  });
}
export async function staffDeleteItemAction(id: string) {
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
  gateways: Gateway[];
  /** سفارش فقط بعد از تأیید پرداخت به آشپزخانه می‌رود */
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
      sms: { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) },
      gateways: mergeGateways(getSetting<Gateway[]>("gateways", [])),
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
  gateways?: Gateway[];
  payFirst?: boolean;
  newPassword?: string;
}, logoForm?: FormData | null): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  await gate();
  const logoBuf = await readUpload(logoForm);
  if (input.cafe || logoBuf) {
    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    let logo = input.cafe?.logo ?? cur.logo;
    if (logoBuf) logo = await saveImageWebp(logoBuf, "logo", 512);
    // ویدیوی هیرو فقط از مسیر آپلود خودش عوض می‌شود
    const next = { ...cur, ...input.cafe, logo, heroVideo: cur.heroVideo, heroPoster: cur.heroPoster };
    // فیلدهای سئو کوتاه بمانند
    for (const [k, n] of [["city", 40], ["phone", 20], ["seoDescription", 160]] as const) if (next[k]) next[k] = String(next[k]).slice(0, n);
    setSetting("cafe", next);
  }
  if (input.payment) {
    setSetting("payment", { ...DEFAULT_PAYMENT, ...getSetting<PaymentInfo>("payment", DEFAULT_PAYMENT), ...input.payment });
  }
  if (input.orderCode === "number" || input.orderCode === "id") setSetting("orderCode", input.orderCode);
  if (input.sms) {
    const cur = { ...DEFAULT_SMS, ...getSetting<Partial<SmsSettings>>("sms", {}) };
    const next = { ...cur, ...input.sms };
    if (next.provider !== "kavenegar" && next.provider !== "wide") next.provider = "none";
    next.otpEnabled = !!next.otpEnabled;
    setSetting("sms", next);
  }
  if (Array.isArray(input.gateways)) setSetting("gateways", mergeGateways(input.gateways));
  if (typeof input.payFirst === "boolean") setSetting("payFirst", input.payFirst);
  if (input.newPassword && input.newPassword.trim()) {
    setAdminPassword(input.newPassword.trim());
  }
  return { ok: true };
  });
}

/** ارسالِ پیامکِ آزمایشی (بعد از ذخیرهٔ تنظیمات) */
export async function staffTestSmsAction(phone: string): Promise<{ ok: boolean; detail: string }> {
  return withTenant(async () => {
    await gate();
    try {
      return { ok: true, detail: await sendTestSms(phone) };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "خطا" };
    }
  });
}

/* ---------- پیامک گروهی ---------- */
export async function staffSetOptOutAction(phone: string, optOut: boolean) {
  return guard(async () => { await gate(); return setSmsOptOut(phone, optOut); });
}
/** شروعِ ارسال به شماره‌های انتخاب‌شده (فقط مشتریانِ ثبت‌شده و غیرلغوشده) */
export async function staffStartSmsCampaignAction(input: { message: string; phones: string[]; addCancel: boolean }) {
  return guard(async () => { await gate(); return startCampaign(input.message, input.phones, input.addCancel); });
}
export async function staffSmsCampaignsAction(): Promise<Campaign[]> {
  return withTenant(async () => {
    await gate();
    return listCampaigns();
  });
}
export async function staffSmsControlAction(id: string, action: "resume" | "retry" | "cancel") {
  return guard(async () => { await gate(); return controlCampaign(id, action); });
}
/** ارسالِ آزمایشیِ همان متن به یک شماره (مثلاً موبایلِ خودِ مدیر) قبل از ارسالِ گروهی */
export async function staffSmsPreviewAction(rawPhone: string, message: string, addCancel: boolean) {
  return guard(async () => {
    await gate();
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) throw new Error("شمارهٔ موبایل را درست وارد کنید (مثل ۰۹۱۲۳۴۵۶۷۸۹)");
    const text = addCancel && !message.includes(CANCEL_FOOTER) ? `${message.trim()}\n${CANCEL_FOOTER}` : message.trim();
    if (!text) throw new Error("متن پیامک را بنویسید");
    return { detail: await sendSmsText(phone, text) };
  });
}

/* ---------- حسابداری ---------- */
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
