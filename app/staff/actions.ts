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
import type { CafeInfo, Menu, Order, OrderStatus, PaymentInfo } from "@/lib/types";

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
export async function staffAddCategoryAction(input: { name: string; emoji?: string }) {
  await gate();
  return addCategory(input);
}
export async function staffUpdateCategoryAction(id: string, input: { name?: string; emoji?: string }) {
  await gate();
  return updateCategory(id, input);
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
}, imageForm?: FormData | null) {
  await gate();
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
export async function staffDeleteItemAction(id: string) {
  await gate();
  return deleteItem(id);
}

/* ---------- settings ---------- */
export interface AdminSettings {
  cafe: CafeInfo;
  payment: PaymentInfo;
  hasPassword: boolean;
}
export async function staffSettingsAction(): Promise<AdminSettings> {
  await gate();
  return {
    cafe: getSetting<CafeInfo>("cafe", { name: "کافه آرتاویل", logo: "☕", tagline: "", currency: "toman" }),
    payment: getSetting<PaymentInfo>("payment", { card: "", holder: "", note: "", link: "" }),
    hasPassword: !!getSetting<string>("admin_pw", ""),
  };
}
export async function staffUpdateSettingsAction(input: {
  cafe?: Partial<CafeInfo>;
  payment?: Partial<PaymentInfo>;
  newPassword?: string;
}, logoForm?: FormData | null): Promise<{ ok: boolean }> {
  await gate();
  const logoBuf = await readUpload(logoForm);
  if (input.cafe || logoBuf) {
    const cur = getSetting<CafeInfo>("cafe", { name: "کافه آرتاویل", logo: "☕", tagline: "", currency: "toman" });
    let logo = input.cafe?.logo ?? cur.logo;
    if (logoBuf) logo = await saveImageWebp(logoBuf, "logo");
    // ویدیوی هیرو فقط از مسیر آپلود خودش عوض می‌شود
    setSetting("cafe", { ...cur, ...input.cafe, logo, heroVideo: cur.heroVideo });
  }
  if (input.payment) {
    const cur = getSetting<PaymentInfo>("payment", { card: "", holder: "", note: "", link: "" });
    setSetting("payment", { ...cur, ...input.payment });
  }
  if (input.newPassword && input.newPassword.trim()) {
    setAdminPassword(input.newPassword.trim());
  }
  return { ok: true };
}

/* ---------- QR ---------- */
export async function staffTableUrlAction(table: number): Promise<string> {
  return `/?table=${table}`;
}
