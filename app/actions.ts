"use server";

import {
  createOrder,
  getBill,
  getOrder,
  attachReceiptToTable,
  receiptReused,
  createRequest,
  createFeedback,
} from "@/lib/queries";
import { saveReceiptWebp, readUpload } from "@/lib/images";
import { isVerifiedPhone, normalizePhone, requestOtp, verifyOtp } from "@/lib/otp";
import type { Bill, Order } from "@/lib/types";

export async function placeOrderAction(
  table: string,
  items: { id: string; qty: number }[],
  extra?: { note?: string; phone?: string }
): Promise<Order> {
  // شماره فقط اگر قبلاً با کد پیامکی تأیید شده باشد ثبت می‌شود
  const phone = extra?.phone && (await isVerifiedPhone(extra.phone)) ? normalizePhone(extra.phone) : "";
  return createOrder({ table, items, note: extra?.note, phone });
}

export async function billAction(table: string): Promise<Bill> {
  return getBill(table);
}

export async function orderAction(id: string): Promise<Order | null> {
  return getOrder(id);
}

export async function ordersAction(ids: string[]): Promise<Order[]> {
  return ids.map((id) => getOrder(id)).filter(Boolean) as Order[];
}

export async function uploadReceiptAction(
  formData: FormData
): Promise<{ ok: boolean; reused: boolean }> {
  const table = String(formData.get("table") || "").trim();
  if (!table) throw new Error("شماره میز نامعتبر است");
  const buf = await readUpload(formData);
  if (!buf) throw new Error("تصویر رسید ارسال نشد");
  const { path, hash } = await saveReceiptWebp(buf, table);
  const reused = receiptReused(hash, table);
  attachReceiptToTable(table, path, hash, reused);
  return { ok: true, reused };
}

export async function requestAction(
  table: string,
  type: "waiter" | "invoice"
): Promise<{ ok: boolean }> {
  createRequest({ table, type });
  return { ok: true };
}

export async function feedbackAction(input: {
  table?: string;
  orderId?: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: boolean }> {
  createFeedback(input);
  return { ok: true };
}

/* ---------- تأیید شمارهٔ مشتری با کد پیامکی ---------- */
export async function otpRequestAction(phone: string): Promise<{ ok: boolean; demoCode?: string }> {
  return requestOtp(phone);
}
export async function otpVerifyAction(phone: string, code: string, table: string): Promise<{ ok: boolean; phone: string }> {
  return verifyOtp(phone, code, table);
}
