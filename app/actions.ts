"use server";

import {
  createOrder,
  getBill,
  getOrder,
  attachReceiptToTable,
  requestPos,
  receiptReused,
  createRequest,
  createFeedback,
} from "@/lib/queries";
import { saveReceiptWebp, readUpload } from "@/lib/images";
import { isVerifiedPhone, normalizePhone, requestOtp, verifyOtp } from "@/lib/otp";
import type { Bill, Order } from "@/lib/types";
import type { ActionFail } from "@/lib/action-result";

/** خطا را (با پیامِ فارسی) برمی‌گرداند؛ پرتاب‌شدن در production پیام را پنهان می‌کند */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    return await fn();
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "خطا" };
  }
}

/** بدون شمارهٔ میز (اسکن نشده) سفارش/درخواست پذیرفته نمی‌شود */
function needTable(table: string): string {
  const t = String(table || "").trim();
  if (!t) throw new Error("برای سفارش، QR روی میز را اسکن کنید");
  return t.slice(0, 20);
}

export async function placeOrderAction(
  table: string,
  items: { id: string; qty: number }[],
  extra?: { note?: string; phone?: string }
): Promise<Order | ActionFail> {
  return guard(async () => {
  table = needTable(table);
  // شماره فقط اگر قبلاً با کد پیامکی تأیید شده باشد ثبت می‌شود
  const phone = extra?.phone && (await isVerifiedPhone(extra.phone)) ? normalizePhone(extra.phone) : "";
  return createOrder({ table, items, note: extra?.note, phone });
  });
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
): Promise<{ ok: boolean; reused: boolean } | ActionFail> {
  return guard(async () => {
  const table = String(formData.get("table") || "").trim();
  if (!table) throw new Error("شماره میز نامعتبر است");
  const buf = await readUpload(formData);
  if (!buf) throw new Error("تصویر رسید ارسال نشد");
  const { path, hash } = await saveReceiptWebp(buf, table);
  const reused = receiptReused(hash, table);
  attachReceiptToTable(table, path, hash, reused);
  return { ok: true, reused };
  });
}

export async function requestAction(
  table: string,
  type: "waiter" | "invoice",
  note = ""
): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  // (نوع pos فقط از مسیرِ posRequestAction ساخته می‌شود)
  table = needTable(table);
  createRequest({ table, type, note: String(note || "").trim().slice(0, 200) });
  return { ok: true };
  });
}

export async function feedbackAction(input: {
  table?: string;
  orderId?: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  createFeedback(input);
  return { ok: true };
  });
}

/* ---------- تأیید شمارهٔ مشتری با کد پیامکی ---------- */
export async function otpRequestAction(phone: string): Promise<{ ok: boolean; demoCode?: string } | ActionFail> {
  return guard(async () => {
  return requestOtp(phone);
  });
}
export async function otpVerifyAction(phone: string, code: string, table: string): Promise<{ ok: boolean; phone: string } | ActionFail> {
  return guard(async () => {
  return verifyOtp(phone, code, table);
  });
}

/** «کارت‌خوان سر میز»: صندوق فاکتور را چاپ می‌کند و سالن‌دار با کارت‌خوان می‌آید */
export async function posRequestAction(table: string): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  return requestPos(needTable(table));
  });
}
