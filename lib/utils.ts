import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export const toFa = (v: string | number) =>
  String(v).replace(/[0-9]/g, (d) => faDigits[+d]);
export const money = (n: number) => toFa(n.toLocaleString("en-US")) + " تومان";
export const formatMoney = (n: number, currency: "toman" | "rial" = "toman") => {
  const v = currency === "rial" ? n * 10 : n;
  return toFa(v.toLocaleString("en-US")) + (currency === "rial" ? " ریال" : " تومان");
};

/** تاریخ شمسی + ساعت، مثل «۱۴۰۵/۷/۲۰ · ۱۹:۳۰» */
export const faDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fa-IR")} · ${faTime(iso)}`;
  } catch {
    return "";
  }
};
export const faTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return toFa(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  } catch {
    return "";
  }
};
/** کد سفارش طبق تنظیمات: «#۱۲» یا شناسهٔ کامل */
export const orderCode = (o: { id: string; number: number }, mode: "number" | "id" = "number") =>
  mode === "id" ? o.id : "#" + toFa(o.number);
