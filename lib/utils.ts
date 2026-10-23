import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Plain number/string for display (kept as a helper so number formatting has one place to change). */
export const num = (v: string | number) => String(v);

/** ISO 4217 currency code, e.g. "USD", "EUR", "GBP". */
export type CurrencyCode = string;

/**
 * Currency used for platform-level amounts (subscription plans, payments, partner commissions).
 * Set once from the platform settings (server) or the admin panel data (client).
 */
let platformCurrency: CurrencyCode = "USD";
export const setPlatformCurrency = (c: string | undefined) => { if (c && /^[A-Z]{3}$/.test(c)) platformCurrency = c; };
export const getPlatformCurrency = () => platformCurrency;

const fmtCache = new Map<string, Intl.NumberFormat>();
/** Format an amount in the given currency; whole amounts drop the ".00". */
export const formatMoney = (n: number, currency: CurrencyCode = platformCurrency) => {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  const key = `${currency}|${whole}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
    } catch {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f.format(n || 0);
};
/** Platform-currency amount (plans, payments, commissions). */
export const money = (n: number) => formatMoney(n, platformCurrency);
/** Round to cents (prices are stored as decimal numbers in the restaurant's currency). */
export const roundMoney = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
/** Parse a user-typed price ("4.50", "1,200") into a number with at most 2 decimals. */
export const parsePrice = (s: string | number) => roundMoney(Number(String(s).replace(/[^\d.]/g, "")) || 0);

/** Date + time, e.g. "Oct 23, 2026 · 19:30" */
export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : `${fmtDate(iso)} · ${fmtTime(iso)}`;
};
export const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
/** e.g. "Oct 23, 2026" */
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? "—" : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
/** Order code per settings: "#12" or the full id */
export const orderCode = (o: { id: string; number: number }, mode: "number" | "id" = "number") =>
  mode === "id" ? o.id : "#" + o.number;

/** URL of a resized copy of an uploaded image (external images are returned as-is) */
export const thumb = (src: string | undefined, w: number) =>
  src && /^\/uploads\/[^?]+\.(webp|jpe?g|png)$/i.test(src) ? `${src}?w=${w}` : src || "";
