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
import { requestHost, requestProto, withTenant } from "@/lib/tenant";
import { startTablePayment } from "@/lib/order-pay";
import { clientIp, myOrderIds, ownsTable, rememberOrder } from "@/lib/security";
import { hit } from "@/lib/limits";
import { currentTenant } from "@/lib/tenant-context";

/** Returns the error (with its message) instead of throwing; thrown errors are hidden in production */
async function guard<T>(fn: () => Promise<T> | T): Promise<T | ActionFail> {
  try {
    // Each action runs in the context of the venue for this request (subdomain)
    return await withTenant(fn, { active: true });
  } catch (e) {
    return { __error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

/** Flood protection: limits per IP and per table (stored on disk, survives restarts) */
async function limitCustomer(kind: string, table: string, perIp: number, perTable: number, windowMs: number) {
  const slug = currentTenant().slug;
  const msg = "Too many requests. Please try again in a few minutes.";
  hit(`${kind}:${slug}:ip:${await clientIp()}`, perIp, windowMs, msg);
  hit(`${kind}:${slug}:t:${table}`, perTable, windowMs, msg);
}

/** Orders/requests are rejected without a table number (QR not scanned) */
function needTable(table: string): string {
  const t = String(table || "").trim();
  if (!t) throw new Error("Scan the QR code on your table to order");
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
  // The phone is saved only if it was verified by SMS code
  const phone = extra?.phone && (await isVerifiedPhone(extra.phone)) ? normalizePhone(extra.phone) : "";
  const order = createOrder({ table, items, note: extra?.note, phone });
  // This browser owns the order (signed cookie) — only it can see the status/bill
  await rememberOrder(order.id);
  return order;
  });
}

const EMPTY_BILL = (table: string): Bill => ({ table, count: 0, total: 0, payStatus: "none", rejectedReason: "", receipt: "", orders: [] });

/** Table bill — only for a browser that has ordered at this table */
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
  if (!table) throw new Error("Invalid table number");
  if (!(await ownsTable(table))) throw new Error("Place an order from this phone first");
  await limitCustomer("receipt", table, 10, 10, 10 * 60_000);
  const buf = await readUpload(formData);
  if (!buf) throw new Error("Receipt image was not received");
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
  // (the pos type is only created via posRequestAction)
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
  // Feedback is linked only to an order owned by this browser
  if (input.orderId && !(await myOrderIds()).includes(input.orderId)) input = { ...input, orderId: undefined };
  createFeedback(input);
  return { ok: true };
  });
}

/* ---------- Customer phone verification by SMS code ---------- */
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

/** "Card reader at the table": the cashier prints the bill and staff bring the card reader */
export async function posRequestAction(table: string): Promise<{ ok: boolean } | ActionFail> {
  return guard(async () => {
  const t = needTable(table);
  await limitCustomer("request", t, 5, 8, 2 * 60_000);
  return requestPos(t);
  });
}

/** Online card payment of the table's open bill (Stripe Checkout); returns the checkout URL */
export async function onlinePayAction(table: string): Promise<{ url: string } | ActionFail> {
  return guard(async () => {
    const t = needTable(table);
    if (!(await ownsTable(t))) throw new Error("Place an order from this phone first");
    await limitCustomer("pay", t, 10, 10, 10 * 60_000);
    const { host, port } = await requestHost();
    return { url: await startTablePayment(t, `${await requestProto()}://${host}${port}`) };
  });
}
