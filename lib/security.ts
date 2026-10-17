import "server-only";
import { cookies, headers } from "next/headers";
import { readSigned, signData } from "@/lib/auth";

/** پشتِ Nginx با HTTPS؟ (Nginx سرآیندِ X-Forwarded-Proto را خودش می‌گذارد) */
export async function isHttps(): Promise<boolean> {
  return (await headers()).get("x-forwarded-proto") === "https";
}
/** تنظیماتِ امنِ کوکی: httpOnly + sameSite + secure روی HTTPS */
export async function cookieOpts(maxAgeSec: number) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: maxAgeSec, secure: await isHttps() };
}
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for") || "x").split(",")[0].trim();
}

/* ---------- سفارش‌های همین مرورگر (جلوگیری از دیدنِ سفارش/صورتحسابِ دیگران) ---------- */
const ORDERS = "cafe_orders";
const ORDERS_TTL = 24 * 3600 * 1000;

export async function myOrderIds(): Promise<string[]> {
  const d = readSigned<{ ids: string[] }>((await cookies()).get(ORDERS)?.value);
  return Array.isArray(d?.ids) ? d!.ids : [];
}
export async function rememberOrder(id: string) {
  const ids = [id, ...(await myOrderIds()).filter((x) => x !== id)].slice(0, 20);
  (await cookies()).set(ORDERS, signData({ ids }, ORDERS_TTL), await cookieOpts(ORDERS_TTL / 1000));
}
