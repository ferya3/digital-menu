import "server-only";
import crypto from "node:crypto";
import { SECRET_SETTINGS, seal, unseal } from "@/lib/secret-box";
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
import { roundMoney } from "@/lib/utils";

// 96 random bits (16 chars) — not guessable
const id = (p: string) => `${p}_${crypto.randomBytes(12).toString("base64url")}`;
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
  created_at: string; updated_at: string; pay_method?: string;
}
function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id, number: r.number, table: r.tbl, items: JSON.parse(r.items || "[]") as unknown as OrderItem[],
    total: r.total, status: r.status, paid: !!r.paid, payStatus: r.pay_status,
    receipt: r.receipt, receiptReused: !!r.receipt_reused, rejectedReason: r.rejected_reason,
    note: r.note || "", phone: r.phone || "", payMethod: r.pay_method || "",
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
  // Prices come from the database so the client can't tamper with them
  const lines: OrderItem[] = [];
  for (const line of input.items) {
    const it = getItem(line.id);
    if (!it || it.available === 0) continue;
    const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
    lines.push({ id: it.id, name: it.name, price: it.price, qty });
  }
  if (lines.length === 0) throw new Error("Your cart has no valid items");
  const total = roundMoney(lines.reduce((s, l) => s + l.price * l.qty, 0));
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
  const total = roundMoney(orders.reduce((s, o) => s + o.total, 0));
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

/** Attaches the receipt to all open orders of the table and sets their payment status to "pending" */
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
/** "Pay first, then kitchen" (on by default) */
export function payFirstEnabled(): boolean {
  return getSetting<boolean>("payFirst", true) !== false;
}
/** Unpaid orders are auto-cancelled after this time (e.g. prank orders from outside the venue) */
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
    // Only starting preparation is locked; an order already in the kitchen continues
    if (cur && !cur.paid && cur.status === "new") throw new Error("This order hasn't been paid yet — confirm the payment at the cashier first");
  }
  db().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), orderId);
  return changed(getOrder(orderId));
}
/** Notifies the panel and the order's table about an order change */
function changed(o: Order | null): Order | null {
  if (o) publish({ type: "order", table: o.table });
  return o;
}
export function setPayStatus(orderId: string, pay: PayStatus, reason = ""): Order | null {
  const d = db();
  if (pay === "confirmed") {
    // Bank transfer receipt approved
    d.prepare("UPDATE orders SET pay_status='confirmed', paid=1, paid_at=CASE WHEN paid=1 AND paid_at!='' THEN paid_at ELSE ? END, pay_method=CASE WHEN pay_method!='' AND paid=1 THEN pay_method ELSE 'receipt' END, updated_at=? WHERE id=?").run(now(), now(), orderId);
  } else if (pay === "rejected") {
    const o = getOrder(orderId);
    const file = o?.receipt || "";
    d.prepare(
      "UPDATE orders SET pay_status='rejected', paid=0, receipt='', receipt_hash='', receipt_reused=0, rejected_reason=?, updated_at=? WHERE id=?"
    ).run(reason.slice(0, 200), now(), orderId);
    // Remove the rejected receipt from the order; delete the file if no other order uses it
    if (file) {
      const used = d.prepare("SELECT COUNT(*) c FROM orders WHERE receipt = ?").get(file) as unknown as { c: number };
      if (used.c === 0) deleteUpload(file);
    }
  } else {
    d.prepare("UPDATE orders SET pay_status=?, updated_at=? WHERE id=?").run(pay, now(), orderId);
  }
  return changed(getOrder(orderId));
}

/** Mark an order paid manually (cash / card reader without a receipt) */
/** Payment method for accounting: receipt = bank transfer, pos = card reader at the table, counter = cashier, online = Stripe */
export type PayMethod = "receipt" | "pos" | "counter" | "online";
export function setPaid(orderId: string, paid: boolean, method: PayMethod = "counter"): Order | null {
  const d = db();
  if (paid) d.prepare("UPDATE orders SET paid=1, pay_status='confirmed', paid_at=?, pay_method=?, updated_at=? WHERE id=? AND paid=0").run(now(), method, now(), orderId);
  else d.prepare("UPDATE orders SET paid=0, pay_status='none', paid_at='', pay_method='', updated_at=? WHERE id=?").run(now(), orderId);
  return changed(getOrder(orderId));
}

/** Customer asked for a card reader at the table: mark all open orders + create a request for the cashier */
export function requestPos(table: string) {
  const open = openBillOrders(table).filter((o) => o.payStatus !== "pending");
  if (!open.length) throw new Error("There is no open bill for this table");
  const upd = db().prepare("UPDATE orders SET pay_status='pos', updated_at=? WHERE id=?");
  for (const o of open) upd.run(now(), o.id);
  // Don't create a duplicate request
  const dup = db().prepare("SELECT id FROM requests WHERE tbl=? AND type='pos' AND status='pending'").get(String(table));
  if (!dup) createRequest({ table, type: "pos" });
  publish({ type: "order", table: String(table) });
  return { ok: true };
}

/** Settles a table's whole open bill (card reader/cash) + closes that table's card reader request */
export function settleTable(table: string): number {
  const open = openBillOrders(table);
  for (const o of open) setPaid(o.id, true, o.payStatus === "pos" ? "pos" : "counter");
  db().prepare("UPDATE requests SET status='done' WHERE tbl=? AND type='pos' AND status='pending'").run(String(table));
  publish({ type: "request", table: String(table) });
  return open.length;
}

/** Approves/rejects the receipt for a table's whole bill (all "pending" orders together) */
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
    amount = roundMoney(open.reduce((s, o) => s + o.total, 0));
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
  if (!r) throw new Error("The rating must be between 1 and 5");
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
    return JSON.parse(unseal(r.value)) as unknown as T;
  } catch {
    return fallback;
  }
}
export function setSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  db().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key, SECRET_SETTINGS.has(key) ? seal(json) : json
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
  /** Opted out of marketing SMS */
  optOut: boolean;
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
  const rows = db().prepare("SELECT * FROM customers ORDER BY last_seen DESC LIMIT 5000").all() as unknown as {
    phone: string; tables: string; visits: number; first_seen: string; last_seen: string; sms_optout: number;
  }[];
  return rows.map((r) => ({
    phone: r.phone, tables: (r.tables || "").split(",").filter(Boolean),
    visits: r.visits, firstSeen: r.first_seen, lastSeen: r.last_seen, optOut: !!r.sms_optout,
  }));
}
export function setSmsOptOut(phone: string, optOut: boolean) {
  db().prepare("UPDATE customers SET sms_optout=? WHERE phone=?").run(optOut ? 1 : 0, phone);
  return { ok: true };
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
  if (has.c > 0) throw new Error("This category still has products. Delete its products first");
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
    Math.max(0, roundMoney(Number(input.price) || 0)), Math.max(0, roundMoney(Number(input.oldPrice) || 0)),
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
    if (k === "price" || k === "oldPrice") v = Math.max(0, roundMoney(Number(v) || 0));
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
