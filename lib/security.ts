import "server-only";
import { cookies, headers } from "next/headers";
import { readSigned, signData } from "@/lib/auth";
import { getOrder } from "@/lib/queries";

/** Behind Nginx with HTTPS? (Nginx sets the X-Forwarded-Proto header itself) */
export async function isHttps(): Promise<boolean> {
  return (await headers()).get("x-forwarded-proto") === "https";
}
/** Safe cookie options: httpOnly + sameSite + secure on HTTPS */
export async function cookieOpts(maxAgeSec: number) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: maxAgeSec, secure: await isHttps() };
}
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") || h.get("x-forwarded-for") || "x").split(",")[0].trim();
}

/* ---------- This browser's orders (prevents seeing other people's orders/bills) ---------- */
const ORDERS = "cafe_orders";
const ORDERS_TTL = 12 * 3600 * 1000;

export async function myOrderIds(): Promise<string[]> {
  const d = readSigned<{ ids: string[] }>((await cookies()).get(ORDERS)?.value);
  return Array.isArray(d?.ids) ? d!.ids : [];
}
/** Has this browser placed an order at this table? (required to see the bill, upload a receipt and use the table's live channel) */
export async function ownsTable(table: string): Promise<boolean> {
  const t = String(table || "").trim();
  if (!t) return false;
  for (const id of await myOrderIds()) if (getOrder(id)?.table === t) return true;
  return false;
}
export async function rememberOrder(id: string) {
  const ids = [id, ...(await myOrderIds()).filter((x) => x !== id)].slice(0, 20);
  (await cookies()).set(ORDERS, signData({ ids }, ORDERS_TTL), await cookieOpts(ORDERS_TTL / 1000));
}
