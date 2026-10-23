import "server-only";
import { getBill, getOrder, getSetting, setPaid } from "@/lib/queries";
import { createCheckout, getCheckout, isPaid } from "@/lib/stripe";
import { currentTenant } from "@/lib/tenant-context";
import { roundMoney } from "@/lib/utils";
import type { CafeInfo, StripeSettings } from "@/lib/types";

/**
 * Online card payment of a table's open bill with the restaurant's own Stripe account.
 * The order ids are fixed in the session metadata; on return/webhook the session is fetched from Stripe
 * and only those orders are marked paid, and only if Stripe's amount matches their total.
 */
function stripeSettings(): StripeSettings {
  return { enabled: false, secretKey: "", ...getSetting<Partial<StripeSettings>>("stripe", {}) };
}
export const onlinePaymentEnabled = () => { const s = stripeSettings(); return s.enabled && !!s.secretKey; };
const cafe = () => getSetting<CafeInfo>("cafe", { name: "Restaurant", logo: "", tagline: "", currency: "USD" });

export async function startTablePayment(table: string, baseUrl: string): Promise<string> {
  const st = stripeSettings();
  if (!st.enabled || !st.secretKey) throw new Error("Online payment is not available");
  const bill = getBill(table);
  const open = bill.orders.filter((o) => o.payStatus !== "pending");
  const amount = roundMoney(open.reduce((s, o) => s + o.total, 0));
  if (!open.length || amount <= 0) throw new Error("There is no open bill for this table");
  const c = cafe();
  const session = await createCheckout({
    key: st.secretKey, amount, currency: c.currency || "USD",
    name: `${c.name} — Table ${table}`, description: `${open.length} order(s)`,
    successUrl: `${baseUrl}/pay/return?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/?table=${encodeURIComponent(table)}&pay=cancel`,
    metadata: { kind: "order", slug: currentTenant().slug, table, orders: open.map((o) => o.id).join(",").slice(0, 490) },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/** Confirm a paid Checkout Session; returns the table (for the redirect) */
export async function confirmTablePayment(sessionId: string): Promise<{ status: "ok" | "pending" | "invalid"; table: string }> {
  const st = stripeSettings();
  if (!st.secretKey) return { status: "invalid", table: "" };
  const s = await getCheckout(st.secretKey, sessionId);
  const m = s.metadata || {};
  if (m.kind !== "order" || m.slug !== currentTenant().slug) return { status: "invalid", table: "" };
  const ids = String(m.orders || "").split(",").filter(Boolean);
  const orders = ids.map((id) => getOrder(id)).filter((o) => o && o.table === m.table && o.status !== "cancelled");
  if (orders.length && orders.every((o) => o!.paid)) return { status: "ok", table: m.table };
  const amount = roundMoney(orders.reduce((sum, o) => sum + o!.total, 0));
  if (!isPaid(s, amount, cafe().currency || "USD")) return { status: "pending", table: m.table };
  for (const o of orders) if (!o!.paid) setPaid(o!.id, true, "online");
  return { status: "ok", table: m.table };
}
