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
