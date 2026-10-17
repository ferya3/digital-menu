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
import { withTenant } from "@/lib/tenant";
import { clientIp, myOrderIds, ownsTable, rememberOrder } from "@/lib/security";
import { hit } from "@/lib/limits";
import { currentTenant } from "@/lib/tenant-context";

/** خطا را (با پیامِ فارسی) برمی‌گرداند؛ پرتاب‌شدن در production پیام را پنهان می‌کند */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    // هر اکشن در زمینهٔ مجموعهٔ همین درخواست (زیردامنه) اجرا می‌شود
    return await withTenant(fn, { active: true });
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "خطا" };
  }
}

/** جلوگیری از سیلِ درخواست: سقف برای هر IP و برای هر میز (روی دیسک، با ری‌استارت پاک نمی‌شود) */
async function limitCustomer(kind: string, table: string, perIp: number, perTable: number, windowMs: number) {
  const slug = currentTenant().slug;
  const msg = "درخواست‌ها زیاد است؛ چند دقیقه بعد دوباره امتحان کنید";
  hit(`${kind}:${slug}:ip:${await clientIp()}`, perIp, windowMs, msg);
  hit(`${kind}:${slug}:t:${table}`, perTable, windowMs, msg);
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
  await limitCustomer("order", table, 10, 20, 5 * 60_000);
  // شماره فقط اگر قبلاً با کد پیامکی تأیید شده باشد ثبت می‌شود
  const phone = extra?.phone && (await isVerifiedPhone(extra.phone)) ? normalizePhone(extra.phone) : "";
  const order = createOrder({ table, items, note: extra?.note, phone });
  // این مرورگر صاحبِ این سفارش است (کوکیِ امضاشده) — فقط خودش وضعیت/صورتحسابش را می‌بیند
  await rememberOrder(order.id);
  return order;
  });
}

const EMPTY_BILL = (table: string): Bill => ({ table, count: 0, total: 0, payStatus: "none", rejectedReason: "", receipt: "", orders: [] });

/** صورتحسابِ میز — فقط برای مرورگری که روی همین میز سفارش داده */
export async function billAction(table: string): Promise<Bill> {
  return withTenant(async () => {
    return (await ownsTable(table)) ? getBill(table) : EMPTY_BILL(table);
  }, { active: true });
}

export async function orderAction(id: string): Promise<Order | null> {
  return withTenant(async () => {
    return (await myOrderIds()).includes(id) ? getOrder(id) : null;
  }, { active: true });
}

export async function ordersAction(ids: string[]): Promise<Order[]> {
  return withTenant(async () => {
    const mine = new Set(await myOrderIds());
    return ids.filter((id) => mine.has(id)).map((id) => getOrder(id)).filter(Boolean) as Order[];
  }, { active: true });
}

export async function uploadReceiptAction(
  formData: FormData
): Promise<{ ok: boolean; reused: boolean } | ActionFail> {
  return guard(async () => {
  const table = String(formData.get("table") || "").trim();
  if (!table) throw new Error("شماره میز نامعتبر است");
  if (!(await ownsTable(table))) throw new Error("ابتدا از همین گوشی سفارش ثبت کنید");
  await limitCustomer("receipt", table, 10, 10, 10 * 60_000);
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
  await limitCustomer("request", table, 5, 8, 2 * 60_000);
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
  await limitCustomer("feedback", input.table || "-", 5, 10, 10 * 60_000);
  // نظر فقط به سفارشِ خودِ همین مرورگر وصل می‌شود
  if (input.orderId && !(await myOrderIds()).includes(input.orderId)) input = { ...input, orderId: undefined };
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
  const t = needTable(table);
  await limitCustomer("request", t, 5, 8, 2 * 60_000);
  return requestPos(t);
  });
}
