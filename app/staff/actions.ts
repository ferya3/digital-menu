"use server";

import {
  checkAdmin,
  isAuthed,
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
import { DEFAULT_SMS, sendTestSms } from "@/lib/otp";
import { getAccounting, type Accounting } from "@/lib/accounting";
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

async function gate() {
  if (!(await isAuthed())) throw new Error("دسترسی غیرمجاز — ابتدا وارد شوید");
}

/* ---------- auth ---------- */
export async function loginAction(password: string): Promise<{ ok: boolean }> {
  if (!checkAdmin(password)) throw new Error("رمز اشتباه است");
  await startSession();
  return { ok: true };
}
export async function logoutAction(): Promise<{ ok: boolean }> {
  await endSession();
  return { ok: true };
}

/* ---------- orders / cashier ---------- */
export async function staffOrdersAction(): Promise<Order[]> {
  await gate();
  return listOrders();
}
export async function staffSetStatusAction(id: string, status: OrderStatus): Promise<Order | null> {
  await gate();
  return setOrderStatus(id, status);
}
export async function staffConfirmPayAction(id: string): Promise<Order | null> {
  await gate();
  return setPayStatus(id, "confirmed");
}
export async function staffRejectPayAction(id: string, reason: string): Promise<Order | null> {
  await gate();
  return setPayStatus(id, "rejected", reason);
}
/** «پرداخت شد» دستی روی یک سفارش */
export async function staffSetPaidAction(id: string, paid: boolean): Promise<Order | null> {
  await gate();
  return setPaid(id, paid);
}
/** تسویهٔ کل صورتحسابِ میز با کارت‌خوان/نقدی */
export async function staffSettleTableAction(table: string): Promise<{ count: number }> {
  await gate();
  return { count: settleTable(table) };
}
/** صندوق: تأیید یا ردِ فیشِ کل صورتحسابِ یک میز */
export async function staffTablePayAction(table: string, pay: "confirmed" | "rejected", reason = ""): Promise<{ count: number }> {
  await gate();
  return { count: setTablePayStatus(table, pay, reason) };
}

/* ---------- requests / feedback / customers ---------- */
export async function staffRequestsAction(): Promise<StaffRequest[]> {
  await gate();
  return listRequests();
}
export async function staffDoneRequestAction(id: string): Promise<{ ok: boolean }> {
  await gate();
  return markRequestDone(id);
}
export async function staffFeedbackAction(): Promise<StaffFeedback[]> {
  await gate();
  return listFeedback();
}
export async function staffCustomersAction(): Promise<StaffCustomer[]> {
  await gate();
  return listCustomers();
}

/* ---------- menu management ---------- */
export async function staffMenuAction(): Promise<Menu> {
  await gate();
  return getMenu();
}
/** افزودن/ویرایش دسته؛ آیکون می‌تواند ایموجی یا عکسِ آپلودی باشد */
export async function staffSaveCategoryAction(input: { id?: string; name: string; emoji?: string }, iconForm?: FormData | null) {
  return saveCategory(input, iconForm);
}
/** بنرِ تبلیغاتیِ تمام‌عرضِ یک دسته: آپلود (FormData) یا حذف (null) */
export async function staffCategoryBannerAction(id: string, bannerForm: FormData | null) {
  await gate();
  const buf = await readUpload(bannerForm);
  const banner = buf ? await saveImageWebp(buf, "banner", 1800) : "";
  updateCategory(id, { banner });
  return { banner };
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
  await gate();
  return deleteCategory(id);
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
}
/** ویرایش سریع قیمت از داخل لیست */
export async function staffQuickPriceAction(id: string, price: number) {
  await gate();
  return updateItem(id, { price });
}
export async function staffDeleteItemAction(id: string) {
  await gate();
  return deleteItem(id);
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
}
export async function staffUpdateSettingsAction(input: {
  cafe?: Partial<CafeInfo>;
  payment?: Partial<PaymentInfo>;
  orderCode?: OrderCodeMode;
  sms?: Partial<SmsSettings>;
  gateways?: Gateway[];
  payFirst?: boolean;
  newPassword?: string;
}, logoForm?: FormData | null): Promise<{ ok: boolean }> {
  await gate();
  const logoBuf = await readUpload(logoForm);
  if (input.cafe || logoBuf) {
    const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
    let logo = input.cafe?.logo ?? cur.logo;
    if (logoBuf) logo = await saveImageWebp(logoBuf, "logo", 512);
    // ویدیوی هیرو فقط از مسیر آپلود خودش عوض می‌شود
    setSetting("cafe", { ...cur, ...input.cafe, logo, heroVideo: cur.heroVideo, heroPoster: cur.heroPoster });
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
}

/** ارسالِ پیامکِ آزمایشی (بعد از ذخیرهٔ تنظیمات) */
export async function staffTestSmsAction(phone: string): Promise<{ ok: boolean; detail: string }> {
  await gate();
  try {
    return { ok: true, detail: await sendTestSms(phone) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "خطا" };
  }
}

/* ---------- حسابداری ---------- */
export async function staffAccountingAction(month?: string): Promise<Accounting> {
  await gate();
  return getAccounting(month);
}

/* ---------- QR ---------- */
export async function staffTableUrlAction(table: number): Promise<string> {
  return `/?table=${table}`;
}
