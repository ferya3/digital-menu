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
  rejectedReason: string;
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
}

export interface PaymentInfo {
  card: string;
  holder: string;
  note: string;
  link: string;
}
