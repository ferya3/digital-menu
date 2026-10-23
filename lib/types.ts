export type OrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";
/** pos = the customer asked for a card reader at the table; the cashier prints the bill and settles it with the card reader */
export type PayStatus = "none" | "pending" | "confirmed" | "rejected" | "pos";

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
  /** The same receipt image was already used for another table (possible duplicate screenshot) */
  receiptReused: boolean;
  rejectedReason: string;
  note: string;
  phone: string;
  /** How it was paid: receipt (bank transfer), pos (card reader), counter, online (Stripe); empty while unpaid */
  payMethod?: string;
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
  /** Full-width promo image above this category (optional) */
  banner?: string;
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
  /** ISO 4217 code, e.g. "USD", "EUR", "GBP" (prices are stored as decimal numbers in this currency) */
  currency: string;
  /** IANA time zone for reports, e.g. "America/New_York" (empty = server default) */
  timezone?: string;
  /** Hero background video; empty = 3D scene */
  heroVideo?: string;
  /** Video poster (first frame) shown until the video loads */
  heroPoster?: string;
  address?: string;
  mapUrl?: string;
  instagram?: string;
  /** Business type (cafe/restaurant/fastfood/other) — drives titles and the welcome scene */
  kind?: string;
  /** SEO and maps */
  phone?: string;
  city?: string;
  seoDescription?: string;
}

/** Order code display: sequential number (#12) or the full id */
export type OrderCodeMode = "number" | "id";

/** SMS provider used for customer phone verification and bulk SMS (Twilio) */
export interface SmsSettings {
  provider: "none" | "twilio";
  /** Twilio Account SID (AC…) */
  accountSid: string;
  /** Twilio Auth Token */
  authToken: string;
  /** Sender: a Twilio phone number in E.164 (+15551234567), an alphanumeric sender id, or a Messaging Service SID (MG…) */
  from: string;
  /** When on, customers verify their phone with an SMS code before ordering */
  otpEnabled: boolean;
}

/** Restaurant-level Stripe account for online card payments of table bills */
export interface StripeSettings {
  enabled: boolean;
  /** Secret key (sk_live_… / sk_test_…) — stored encrypted */
  secretKey: string;
}

/** Payment options offered to customers */
export interface PaymentInfo {
  /** Bank transfer details shown to the customer (account / IBAN) */
  card: string;
  /** Account holder */
  holder: string;
  /** Extra note shown with the payment options */
  note: string;
  /** Optional external payment link (e.g. a payment page) */
  link: string;
  /** Bank transfer with receipt upload */
  allowCard?: boolean;
  /** Card reader at the table */
  allowPos?: boolean;
  /** Derived (not stored): online card payment with Stripe is available */
  online?: boolean;
}
export type RequestType = "waiter" | "invoice" | "pos";
