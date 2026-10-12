import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { deleteUpload } from "@/lib/images";
import { publish } from "@/lib/live";
import type {
  Bill,
  Menu,
  Order,
  OrderItem,
  OrderStatus,
  PayStatus,
  RequestType,
} from "@/lib/types";

const id = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;
const now = () => new Date().toISOString();

/* ---------- menu ---------- */
interface ItemRow {
  id: string; category_id: string; name: string; description: string;
  price: number; old_price: number; emoji: string; image: string; tag: string; available: number;
}
interface CatRow { id: string; name: string; emoji: string; banner: string }

export function getMenu(): Menu {
  const d = db();
  const categories = (d.prepare("SELECT id, name, emoji, banner FROM categories ORDER BY sort").all() as unknown as CatRow[]).map(
    (c) => ({ id: c.id, name: c.name, emoji: c.emoji, ...(c.banner ? { banner: c.banner } : {}) })
  );
  const items = (d.prepare("SELECT * FROM items ORDER BY sort").all() as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    category: r.category_id,
    name: r.name,
    desc: r.description,
    price: r.price,
    oldPrice: r.old_price > 0 ? r.old_price : undefined,
    emoji: r.emoji,
    image: r.image || undefined,
    tag: r.tag || undefined,
    available: !!r.available,
  }));
  return { categories, items };
}

export function getItem(itemId: string): ItemRow | undefined {
  return db().prepare("SELECT * FROM items WHERE id = ?").get(itemId) as unknown as ItemRow | undefined;
}

/* ---------- orders ---------- */
interface OrderRow {
  id: string; number: number; tbl: string; items: string; total: number;
  status: OrderStatus; paid: number; pay_status: PayStatus; receipt: string;
  receipt_reused: number; rejected_reason: string; note: string; phone: string;
  created_at: string; updated_at: string;
}
function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id, number: r.number, table: r.tbl, items: JSON.parse(r.items || "[]") as unknown as OrderItem[],
    total: r.total, status: r.status, paid: !!r.paid, payStatus: r.pay_status,
    receipt: r.receipt, receiptReused: !!r.receipt_reused, rejectedReason: r.rejected_reason,
    note: r.note || "", phone: r.phone || "",
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function createOrder(input: {
  table: string;
  items: { id: string; qty: number }[];
  phone?: string;
  note?: string;
}): Order {
  const d = db();
  // قیمت‌ها از روی دیتابیس محاسبه می‌شوند تا قابل دستکاری از سمت کاربر نباشد
  const lines: OrderItem[] = [];
  for (const line of input.items) {
    const it = getItem(line.id);
    if (!it || it.available === 0) continue;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    lines.push({ id: it.id, name: it.name, price: it.price, qty });
  }
  if (lines.length === 0) throw new Error("هیچ آیتم معتبری در سبد نیست");
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const number =
    (d.prepare("SELECT COALESCE(MAX(number),0)+1 n FROM orders").get() as unknown as { n: number }).n;
  const oid = id("ord");
  const ts = now();
  d.prepare(
    `INSERT INTO orders (id, number, tbl, items, total, status, paid, pay_status, phone, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'new', 0, 'none', ?, ?, ?, ?)`
  ).run(
    oid, number, String(input.table), JSON.stringify(lines), total,
    input.phone || "", (input.note || "").toString().trim().slice(0, 500), ts, ts
  );
  if (input.phone) addCustomer(input.phone, input.table);
  publish({ type: "order", table: String(input.table) });
  return rowToOrder(d.prepare("SELECT * FROM orders WHERE id = ?").get(oid) as unknown as OrderRow);
}

export function getOrder(orderId: string): Order | null {
  const r = db().prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as unknown as OrderRow | undefined;
  return r ? rowToOrder(r) : null;
}

export function openBillOrders(table: string): Order[] {
  const rows = db()
    .prepare(
      "SELECT * FROM orders WHERE tbl = ? AND status != 'cancelled' AND paid = 0 ORDER BY created_at ASC"
    )
    .all(String(table)) as unknown as OrderRow[];
  return rows.map(rowToOrder);
}

export function getBill(table: string): Bill {
  const orders = openBillOrders(table);
  const total = orders.reduce((s, o) => s + o.total, 0);
  const rejected = orders.find((o) => o.payStatus === "rejected");
  const receipt = (orders.find((o) => o.receipt)?.receipt) || "";
  const payStatus: PayStatus = orders.some((o) => o.payStatus === "pending")
    ? "pending"
    : orders.some((o) => o.payStatus === "pos")
      ? "pos"
      : rejected
      ? "rejected"
      : "none";
  return {
    table: String(table),
    count: orders.length,
    total,
    payStatus,
    rejectedReason: rejected?.rejectedReason || "",
    receipt,
    orders,
  };
}

/** رسید را به همهٔ سفارش‌های بازِ میز می‌چسباند و وضعیت پرداخت را «در انتظار» می‌کند */
export function attachReceiptToTable(table: string, imagePath: string, hash: string, reused = false): number {
  const d = db();
  const open = openBillOrders(table);
  const ts = now();
  const upd = d.prepare(
    "UPDATE orders SET receipt = ?, receipt_hash = ?, receipt_reused = ?, pay_status = 'pending', updated_at = ? WHERE id = ?"
  );
  for (const o of open) upd.run(imagePath, hash, reused ? 1 : 0, ts, o.id);
  publish({ type: "receipt", table: String(table) });
  return open.length;
}

export function receiptReused(hash: string, excludeTable: string): boolean {
  if (!hash) return false;
  const r = db()
    .prepare("SELECT COUNT(*) c FROM orders WHERE receipt_hash = ? AND tbl != ?")
    .get(hash, String(excludeTable)) as unknown as { c: number };
  return r.c > 0;
}

/* staff: change status / payment */
/** «اول پرداخت، بعد آشپزخانه» (پیش‌فرض روشن) */
export function payFirstEnabled(): boolean {
  return getSetting<boolean>("payFirst", true) !== false;
}
/** سفارشِ پرداخت‌نشده بعد از این مدت خودکار لغو می‌شود (مثلاً سفارشِ مزاحم از بیرونِ کافه) */
const UNPAID_EXPIRE_MS = 60 * 60 * 1000;
function expireUnpaid() {
  if (!payFirstEnabled()) return;
  const cutoff = new Date(Date.now() - UNPAID_EXPIRE_MS).toISOString();
  const rows = db()
    .prepare("SELECT id, tbl FROM orders WHERE status='new' AND paid=0 AND pay_status IN ('none','rejected') AND created_at < ?")
    .all(cutoff) as unknown as { id: string; tbl: string }[];
  if (!rows.length) return;
  const upd = db().prepare("UPDATE orders SET status='cancelled', updated_at=? WHERE id=?");
  for (const r of rows) upd.run(now(), r.id);
  for (const t of new Set(rows.map((r) => r.tbl))) publish({ type: "order", table: t });
}

export function setOrderStatus(orderId: string, status: OrderStatus): Order | null {
  if (status !== "cancelled" && status !== "new" && payFirstEnabled()) {
    const cur = getOrder(orderId);
    // فقط شروعِ آماده‌سازی قفل است؛ سفارشی که از قبل در آشپزخانه بوده ادامه می‌دهد
    if (cur && !cur.paid && cur.status === "new") throw new Error("این سفارش هنوز پرداخت نشده — اول پرداخت را در صندوق تأیید کنید");
  }
  db().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), orderId);
  return changed(getOrder(orderId));
}
/** اعلامِ تغییرِ سفارش به پنل و به میزِ همان سفارش */
function changed(o: Order | null): Order | null {
  if (o) publish({ type: "order", table: o.table });
  return o;
}
export function setPayStatus(orderId: string, pay: PayStatus, reason = ""): Order | null {
  const d = db();
  if (pay === "confirmed") {
    d.prepare("UPDATE orders SET pay_status='confirmed', paid=1, updated_at=? WHERE id=?").run(now(), orderId);
  } else if (pay === "rejected") {
    const o = getOrder(orderId);
    const file = o?.receipt || "";
    d.prepare(
      "UPDATE orders SET pay_status='rejected', paid=0, receipt='', receipt_hash='', receipt_reused=0, rejected_reason=?, updated_at=? WHERE id=?"
    ).run(reason.slice(0, 200), now(), orderId);
    // فیشِ ردشده را از سفارش پاک کن؛ اگر سفارش دیگری همان فایل را استفاده نمی‌کند، فایل را حذف کن
    if (file) {
      const used = d.prepare("SELECT COUNT(*) c FROM orders WHERE receipt = ?").get(file) as unknown as { c: number };
      if (used.c === 0) deleteUpload(file);
    }
  } else {
    d.prepare("UPDATE orders SET pay_status=?, updated_at=? WHERE id=?").run(pay, now(), orderId);
  }
  return changed(getOrder(orderId));
}

/** علامت «پرداخت شد» دستی (پرداخت نقدی/کارتخوان بدون فیش) */
export function setPaid(orderId: string, paid: boolean): Order | null {
  const d = db();
  if (paid) d.prepare("UPDATE orders SET paid=1, pay_status='confirmed', updated_at=? WHERE id=?").run(now(), orderId);
  else d.prepare("UPDATE orders SET paid=0, pay_status='none', updated_at=? WHERE id=?").run(now(), orderId);
  return changed(getOrder(orderId));
}

/** مشتری «کارت‌خوان سر میز» خواست: همهٔ سفارش‌های بازِ میز علامت می‌خورند + درخواست برای صندوق */
export function requestPos(table: string) {
  const open = openBillOrders(table).filter((o) => o.payStatus !== "pending");
  if (!open.length) throw new Error("صورتحساب بازی برای این میز نیست");
  const upd = db().prepare("UPDATE orders SET pay_status='pos', updated_at=? WHERE id=?");
  for (const o of open) upd.run(now(), o.id);
  // درخواستِ تکراری نساز
  const dup = db().prepare("SELECT id FROM requests WHERE tbl=? AND type='pos' AND status='pending'").get(String(table));
  if (!dup) createRequest({ table, type: "pos" });
  publish({ type: "order", table: String(table) });
  return { ok: true };
}

/** تسویهٔ کلِ صورتحسابِ بازِ یک میز (کارت‌خوان/نقدی) + بستنِ درخواستِ کارت‌خوانِ آن میز */
export function settleTable(table: string): number {
  const open = openBillOrders(table);
  for (const o of open) setPaid(o.id, true);
  db().prepare("UPDATE requests SET status='done' WHERE tbl=? AND type='pos' AND status='pending'").run(String(table));
  publish({ type: "request", table: String(table) });
  return open.length;
}

/** تأیید/ردِ فیشِ کل صورتحسابِ یک میز (همهٔ سفارش‌های «در انتظار» با هم) */
export function setTablePayStatus(table: string, pay: "confirmed" | "rejected", reason = ""): number {
  const rows = db()
    .prepare("SELECT id FROM orders WHERE tbl = ? AND pay_status = 'pending'")
    .all(String(table)) as unknown as { id: string }[];
  for (const r of rows) setPayStatus(r.id, pay, reason);
  return rows.length;
}

/* ---------- requests ---------- */
export function createRequest(input: { table: string; type: RequestType; note?: string }) {
  const d = db();
  let amount = 0, orderCount = 0;
  if (input.type === "invoice" || input.type === "pos") {
    const open = openBillOrders(input.table);
    amount = open.reduce((s, o) => s + o.total, 0);
    orderCount = open.length;
  }
  const rid = id("req");
  d.prepare(
    "INSERT INTO requests (id, tbl, type, note, status, amount, order_count, created_at) VALUES (?,?,?,?,'pending',?,?,?)"
  ).run(rid, String(input.table), input.type, (input.note || "").slice(0, 200), amount, orderCount, now());
  publish({ type: "request", table: String(input.table) });
  return { id: rid };
}

/* ---------- feedback ---------- */
export function createFeedback(input: { table?: string; orderId?: string; rating: number; comment?: string }) {
  const r = Math.min(5, Math.max(1, Math.floor(Number(input.rating) || 0)));
  if (!r) throw new Error("امتیاز باید بین ۱ تا ۵ باشد");
  db().prepare(
    "INSERT INTO feedback (id, tbl, order_id, rating, comment, created_at) VALUES (?,?,?,?,?,?)"
  ).run(id("fb"), input.table || "", input.orderId || "", r, (input.comment || "").slice(0, 1000), now());
  publish({ type: "feedback", table: input.table || "" });
  return { ok: true };
}

/* ---------- customers ---------- */
export function addCustomer(phone: string, table?: string) {
  const p = String(phone).replace(/[^\d+]/g, "");
  if (p.length < 8) return;
  const d = db();
  const row = d.prepare("SELECT * FROM customers WHERE phone = ?").get(p) as unknown as
    | { tables: string; visits: number } | undefined;
  const ts = now();
  if (row) {
    const tables = new Set((row.tables || "").split(",").filter(Boolean));
    if (table) tables.add(String(table));
    d.prepare("UPDATE customers SET tables=?, visits=visits+1, last_seen=? WHERE phone=?").run(
      [...tables].join(","), ts, p
    );
  } else {
    d.prepare("INSERT INTO customers (phone, tables, visits, first_seen, last_seen) VALUES (?,?,1,?,?)").run(
      p, table ? String(table) : "", ts, ts
    );
  }
}

/* ---------- settings ---------- */
export function getSetting<T = unknown>(key: string, fallback: T): T {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(key) as unknown as { value: string } | undefined;
  if (!r) return fallback;
  try {
    return JSON.parse(r.value) as unknown as T;
  } catch {
    return fallback;
  }
}
export function setSetting(key: string, value: unknown) {
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key, JSON.stringify(value)
  );
}

/* ======================= STAFF / ADMIN ======================= */
export interface StaffRequest {
  id: string; table: string; type: RequestType; note: string;
  status: "pending" | "done"; amount: number; orderCount: number; createdAt: string;
}
export interface StaffFeedback {
  id: string; table: string; orderId: string; rating: number; comment: string; createdAt: string;
}
export interface StaffCustomer {
  phone: string; tables: string[]; visits: number; firstSeen: string; lastSeen: string;
}

export function listOrders(limit = 200): Order[] {
  expireUnpaid();
  const rows = db().prepare("SELECT * FROM orders ORDER BY number DESC LIMIT ?").all(limit) as unknown as OrderRow[];
  return rows.map(rowToOrder);
}

export function listRequests(): StaffRequest[] {
  const rows = db().prepare("SELECT * FROM requests ORDER BY created_at DESC LIMIT 300").all() as unknown as {
    id: string; tbl: string; type: RequestType; note: string; status: "pending" | "done";
    amount: number; order_count: number; created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id, table: r.tbl, type: r.type, note: r.note, status: r.status,
    amount: r.amount, orderCount: r.order_count, createdAt: r.created_at,
  }));
}
export function markRequestDone(id: string) {
  db().prepare("UPDATE requests SET status='done' WHERE id=?").run(id);
  publish({ type: "request" });
  return { ok: true };
}

export function listFeedback(): StaffFeedback[] {
  const rows = db().prepare("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 300").all() as unknown as {
    id: string; tbl: string; order_id: string; rating: number; comment: string; created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id, table: r.tbl, orderId: r.order_id, rating: r.rating, comment: r.comment, createdAt: r.created_at,
  }));
}

export function listCustomers(): StaffCustomer[] {
  const rows = db().prepare("SELECT * FROM customers ORDER BY last_seen DESC LIMIT 1000").all() as unknown as {
    phone: string; tables: string; visits: number; first_seen: string; last_seen: string;
  }[];
  return rows.map((r) => ({
    phone: r.phone, tables: (r.tables || "").split(",").filter(Boolean),
    visits: r.visits, firstSeen: r.first_seen, lastSeen: r.last_seen,
  }));
}

/* ---------- menu management ---------- */
export function addCategory(input: { name: string; emoji?: string }) {
  const cid = id("cat");
  const sort = (db().prepare("SELECT COALESCE(MAX(sort),0)+1 s FROM categories").get() as unknown as { s: number }).s;
  db().prepare("INSERT INTO categories (id, name, emoji, sort) VALUES (?,?,?,?)").run(
    cid, String(input.name).trim(), input.emoji?.trim() || "🍽️", sort
  );
  return { id: cid };
}
export function updateCategory(cid: string, input: { name?: string; emoji?: string; banner?: string }) {
  const d = db();
  if (input.banner != null) {
    const old = (d.prepare("SELECT banner FROM categories WHERE id=?").get(cid) as unknown as { banner: string } | undefined)?.banner;
    if (old && old !== input.banner) deleteUpload(old);
    d.prepare("UPDATE categories SET banner=? WHERE id=?").run(input.banner, cid);
  }
  if (input.name != null) d.prepare("UPDATE categories SET name=? WHERE id=?").run(String(input.name).trim(), cid);
  if (input.emoji != null) d.prepare("UPDATE categories SET emoji=? WHERE id=?").run(String(input.emoji).trim(), cid);
  return { ok: true };
}
export function deleteCategory(cid: string) {
  const d = db();
  const has = d.prepare("SELECT COUNT(*) c FROM items WHERE category_id=?").get(cid) as unknown as { c: number };
  if (has.c > 0) throw new Error("این دسته محصول دارد؛ ابتدا محصولات آن را حذف کن");
  d.prepare("DELETE FROM categories WHERE id=?").run(cid);
  return { ok: true };
}

export function addItem(input: {
  name: string; categoryId: string; description?: string; price?: number;
  oldPrice?: number; emoji?: string; image?: string; tag?: string; available?: boolean;
}) {
  const iid = id("item");
  const sort = (db().prepare("SELECT COALESCE(MAX(sort),0)+1 s FROM items").get() as unknown as { s: number }).s;
  db().prepare(
    `INSERT INTO items (id, category_id, name, description, price, old_price, emoji, image, tag, available, sort)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    iid, input.categoryId, String(input.name).trim(), (input.description || "").trim(),
    Math.max(0, Math.round(Number(input.price) || 0)), Math.max(0, Math.round(Number(input.oldPrice) || 0)),
    input.emoji?.trim() || "🍽️", input.image || "", input.tag?.trim() || "",
    input.available === false ? 0 : 1, sort
  );
  return { id: iid };
}
export function updateItem(iid: string, input: Record<string, unknown>) {
  const d = db();
  const map: Record<string, string> = {
    name: "name", categoryId: "category_id", description: "description",
    price: "price", oldPrice: "old_price", emoji: "emoji", image: "image", tag: "tag",
  };
  for (const [k, col] of Object.entries(map)) {
    if (input[k] == null) continue;
    let v: string | number = input[k] as string | number;
    if (k === "price" || k === "oldPrice") v = Math.max(0, Math.round(Number(v) || 0));
    else v = String(v).trim();
    d.prepare(`UPDATE items SET ${col}=? WHERE id=?`).run(v, iid);
  }
  if (typeof input.available === "boolean")
    d.prepare("UPDATE items SET available=? WHERE id=?").run(input.available ? 1 : 0, iid);
  return { ok: true };
}
export function deleteItem(iid: string) {
  db().prepare("DELETE FROM items WHERE id=?").run(iid);
  return { ok: true };
}
