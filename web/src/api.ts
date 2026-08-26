import type { Dish } from "@/data";
import { DISHES, CATEGORIES } from "@/data";

/**
 * پایهٔ آدرس بک‌اند. در حالت توسعه، پراکسیِ Vite درخواست‌های /api و /socket.io
 * را به سرور Node می‌فرستد، پس مقدار خالی کافی است. برای اتصال به یک سرور دیگر،
 * متغیر VITE_API_URL را ست کن (مثلاً https://artavilstar.com).
 */
export const API = (import.meta.env.VITE_API_URL as string) || "";

/* ---------- انواع سمت سرور ---------- */
export interface ServerCategory {
  id: string;
  name: string;
  icon: string;
}
export interface ServerItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  oldPrice: number;
  rating: number;
  emoji: string;
  image: string;
  available: boolean;
}
export interface ServerMenu {
  categories: ServerCategory[];
  items: ServerItem[];
}

export interface BillOrder {
  id: string;
  number: number;
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  status: string;
  paid: boolean;
  payStatus: string;
  receipt: string;
  createdAt: string;
}
export interface Bill {
  table: string;
  count: number;
  total: number;
  payStatus: "none" | "pending" | "rejected";
  rejectedReason: string;
  receipt: string;
  orders: BillOrder[];
}

/* ---------- ابزار ---------- */
// جای‌گزینِ عکس وقتی محصول عکس ندارد: یک SVG گرم با ایموجی (بدون نیاز به اینترنت).
export function placeholderImg(emoji = "☕"): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#3a2a22'/><stop offset='1' stop-color='#1a1210'/>
    </linearGradient></defs>
    <rect width='800' height='600' fill='url(#g)'/>
    <text x='400' y='330' font-size='220' text-anchor='middle'>${emoji}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function imgUrl(image: string, emoji: string): string {
  if (!image) return placeholderImg(emoji);
  if (/^https?:|^data:/.test(image)) return image;
  return API + image; // مسیر نسبی مثل /images/xxx.jpg
}

/** یک آیتم سرور را به شکلِ Dish موردنیازِ رابط کاربری تبدیل می‌کند. */
export function itemToDish(it: ServerItem): Dish {
  return {
    id: it.id,
    category: it.categoryId,
    titleLine1: it.name,
    desc: it.description || undefined,
    img: imgUrl(it.image, it.emoji),
    price: it.price,
    oldPrice: it.oldPrice > 0 ? it.oldPrice : undefined,
    tag: it.emoji && it.emoji !== "🍽️" ? it.emoji : undefined,
    ctaText: "افزودن",
  };
}

/* ---------- فراخوان‌ها ---------- */
async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let msg = `خطا (${res.status})`;
    try {
      const b = await res.json();
      if (b && b.error) msg = b.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface MenuResult {
  categories: { id: string; name: string }[];
  dishes: Dish[];
  online: boolean;
}

/** منو را از سرور می‌گیرد؛ اگر سرور در دسترس نبود، دادهٔ نمونهٔ محلی را برمی‌گرداند. */
export async function fetchMenu(): Promise<MenuResult> {
  try {
    const menu = await jsonFetch<ServerMenu>("/api/menu");
    const dishes = menu.items
      .filter((it) => it.available !== false)
      .map(itemToDish);
    const categories = menu.categories.map((c) => ({ id: c.id, name: c.name }));
    if (dishes.length === 0) throw new Error("empty");
    return { categories, dishes, online: true };
  } catch {
    // آفلاین/دمو: دادهٔ محلی
    return {
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
      dishes: DISHES,
      online: false,
    };
  }
}

export function createOrder(input: {
  table: string;
  items: { id: string; qty: number }[];
  note?: string;
  phone?: string;
}): Promise<import("@/socket").ServerOrder> {
  return jsonFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchBill(table: string): Promise<Bill> {
  return jsonFetch<Bill>(`/api/orders/table/${encodeURIComponent(table)}/bill`);
}

export function fetchOrder(id: string): Promise<import("@/socket").ServerOrder> {
  return jsonFetch(`/api/orders/${encodeURIComponent(id)}`);
}

export function uploadTableReceipt(
  table: string,
  image: string
): Promise<{ ok: boolean; receipt: string; count: number; reused: boolean }> {
  return jsonFetch(`/api/orders/table/${encodeURIComponent(table)}/receipt`, {
    method: "POST",
    body: JSON.stringify({ image }),
  });
}

/* ---------- درخواست‌ها (مشتری) ---------- */
export interface CafeRequest {
  id: string;
  table: string;
  type: "waiter" | "invoice";
  note: string;
  status: "pending" | "done";
  amount?: number;
  orderCount?: number;
  createdAt: string;
}

export function createRequest(input: {
  table: string;
  type: "waiter" | "invoice";
  note?: string;
}): Promise<CafeRequest> {
  return jsonFetch("/api/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------- پنل کارکنان (نیازمند ورود) ---------- */
export function login(password: string): Promise<{ ok: boolean }> {
  return jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function me(): Promise<boolean> {
  try {
    const r = await jsonFetch<{ authed: boolean }>("/api/auth/me");
    return !!r.authed;
  } catch {
    return false;
  }
}

export function logout(): Promise<unknown> {
  return jsonFetch("/api/auth/logout", { method: "POST" });
}

export function fetchOrders(): Promise<import("@/socket").ServerOrder[]> {
  return jsonFetch("/api/orders");
}

export function patchOrder(
  id: string,
  body: { status?: string; payStatus?: string; reason?: string; paid?: boolean }
): Promise<import("@/socket").ServerOrder> {
  return jsonFetch(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchRequests(): Promise<CafeRequest[]> {
  return jsonFetch("/api/requests");
}

export function patchRequest(id: string): Promise<CafeRequest> {
  return jsonFetch(`/api/requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });
}

/* ---------- مدیریت منو (مدیر) ---------- */
export function fetchMenuRaw(): Promise<ServerMenu> {
  return jsonFetch("/api/menu");
}

export function addCategory(body: { name: string; icon?: string }): Promise<ServerCategory> {
  return jsonFetch("/api/menu/categories", { method: "POST", body: JSON.stringify(body) });
}
export function updateCategory(
  id: string,
  body: { name?: string; icon?: string }
): Promise<ServerCategory> {
  return jsonFetch(`/api/menu/categories/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
export function deleteCategory(id: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/menu/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface ItemInput {
  name: string;
  categoryId?: string;
  newCategory?: string;
  description?: string;
  price?: number;
  oldPrice?: number;
  emoji?: string;
  image?: string;
  available?: boolean;
}
export function addItem(body: ItemInput): Promise<ServerItem> {
  return jsonFetch("/api/menu/items", { method: "POST", body: JSON.stringify(body) });
}
export function updateItem(id: string, body: Partial<ItemInput>): Promise<ServerItem> {
  return jsonFetch(`/api/menu/items/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
export function deleteItem(id: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/menu/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// آدرسِ تصویرِ QR میز (سرور تولید می‌کند)
export function qrUrl(table: string | number): string {
  return `${API}/api/qr?table=${encodeURIComponent(String(table))}`;
}

// آدرسِ کاملِ منوی میز (برای نمایش/کپی زیر QR)
export function tableMenuUrl(table: string | number): string {
  const origin = API || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/?table=${encodeURIComponent(String(table))}`;
}
