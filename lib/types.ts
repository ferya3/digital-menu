export type OrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";
export type PayStatus = "none" | "pending" | "confirmed" | "rejected";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  number: number;
  table: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  paid: boolean;
  payStatus: PayStatus;
  receipt: string;
  /** همین تصویرِ فیش قبلاً برای میز دیگری استفاده شده (احتمال اسکرین‌شات تکراری) */
  receiptReused: boolean;
  rejectedReason: string;
  note: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  table: string;
  count: number;
  total: number;
  payStatus: PayStatus;
  rejectedReason: string;
  receipt: string;
  orders: Order[];
}

export interface MenuCategory {
  id: string;
  name: string;
  emoji: string;
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  desc: string;
  price: number;
  oldPrice?: number;
  emoji: string;
  image?: string;
  tag?: string;
  available: boolean;
}

export interface Menu {
  categories: MenuCategory[];
  items: MenuItem[];
}

export interface CafeInfo {
  name: string;
  logo: string;
  tagline: string;
  currency: "toman" | "rial";
  /** ویدیوی پس‌زمینهٔ هیرو؛ خالی = صحنهٔ سه‌بعدی */
  heroVideo?: string;
  /** عکسِ کاورِ ویدیو (فریم اول) تا قبل از رسیدنِ ویدیو */
  heroPoster?: string;
  address?: string;
  mapUrl?: string;
  instagram?: string;
}

/** نمایش کد سفارش: عدد ترتیبی (#۱۲) یا شناسهٔ کامل */
export type OrderCodeMode = "number" | "id";

/** سامانهٔ پیامک برای کد تأیید شمارهٔ مشتری */
export interface SmsSettings {
  provider: "none" | "kavenegar";
  apiKey: string;
  template: string;
  /** اگر روشن باشد، مشتری قبل از دیدن منو شماره‌اش را با کد پیامکی تأیید می‌کند */
  otpEnabled: boolean;
}

/** اطلاعات درگاه پرداخت (زرین‌پال، ملت، ملی) */
export interface Gateway {
  id: "zarinpal" | "mellat" | "melli";
  name: string;
  enabled: boolean;
  config: Record<string, string>;
}

export interface PaymentInfo {
  card: string;
  holder: string;
  note: string;
  link: string;
}
