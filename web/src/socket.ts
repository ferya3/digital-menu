import { io, type Socket } from "socket.io-client";
import { API } from "@/api";

/**
 * یک اتصال Socket.IO به بک‌اند می‌سازد و مشتری را به اتاقِ میز می‌فرستد
 * تا رویدادهای زندهٔ `order:updated` را دریافت کند.
 * در حالت توسعه از پراکسیِ Vite رد می‌شود (همان مبدأ)، در تولید به API وصل می‌شود.
 */
export function connectTable(
  table: string,
  onOrderUpdated: (order: ServerOrder) => void,
  onMenuUpdated?: () => void
): Socket {
  // API خالی یعنی همان مبدأ (پراکسیِ Vite). وگرنه به آدرس سرور وصل شو.
  const socket: Socket = io(API || undefined, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });

  const join = () => socket.emit("join:table", table);
  socket.on("connect", join);
  socket.on("order:updated", (order: ServerOrder) => {
    if (order && String(order.table) === String(table)) onOrderUpdated(order);
  });
  if (onMenuUpdated) socket.on("menu:updated", onMenuUpdated);

  return socket;
}

/**
 * اتصال کارکنان: به اتاق `staff` می‌پیوندد و رویدادهای زندهٔ سفارش و درخواست را می‌گیرد.
 * (پیوستن به اتاق staff در سرور با کوکیِ ورود بررسی می‌شود.)
 */
export function connectStaff(handlers: {
  onOrder?: (o: ServerOrder) => void;
  onRequest?: (r: unknown) => void;
}): Socket {
  const socket: Socket = io(API || undefined, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
  });
  const join = () => socket.emit("join:staff");
  socket.on("connect", join);
  if (handlers.onOrder) {
    socket.on("order:new", handlers.onOrder);
    socket.on("order:updated", handlers.onOrder);
  }
  if (handlers.onRequest) {
    socket.on("request:new", handlers.onRequest);
    socket.on("request:updated", handlers.onRequest);
  }
  return socket;
}

export interface ServerOrder {
  id: string;
  number: number;
  table: string;
  items: { id: string; name: string; price: number; qty: number }[];
  total: number;
  status: "new" | "preparing" | "ready" | "served" | "cancelled";
  paid: boolean;
  payStatus: "none" | "pending" | "confirmed" | "rejected";
  rejectedReason?: string;
  receipt?: string;
  receiptReused?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* برچسب‌های فارسیِ وضعیت — همان‌هایی که در نسخهٔ قبلی بود */
export const STATUS_STEPS: ServerOrder["status"][] = [
  "new",
  "preparing",
  "ready",
  "served",
];

export const STATUS_FA: Record<ServerOrder["status"], string> = {
  new: "در انتظار تأیید آشپزخانه",
  preparing: "در حال آماده‌سازی ☕",
  ready: "آماده است! ✅",
  served: "سرو شد",
  cancelled: "لغو شد",
};

export const STATUS_SHORT: Record<ServerOrder["status"], string> = {
  new: "ثبت شد",
  preparing: "آماده‌سازی",
  ready: "آماده",
  served: "سرو شد",
  cancelled: "لغو شد",
};
