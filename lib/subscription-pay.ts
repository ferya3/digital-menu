import "server-only";
import { getPayment, markPaymentFailed, markPaymentPaid, platformSettings } from "@/lib/platform";
import { getCheckout, isPaid } from "@/lib/stripe";
import { audit } from "@/lib/platform-admin";

/**
 * Confirm a subscription payment from its Stripe Checkout Session (used by the return URL and the webhook).
 * The session is fetched from Stripe with the platform key; amount and currency must match the payment record.
 */
export async function confirmSubscriptionSession(payId: string, sessionId: string): Promise<"ok" | "pending" | "invalid" | "fail"> {
  const pay = getPayment(payId);
  if (!pay || pay.method !== "stripe" || pay.authority !== sessionId) return "invalid";
  if (pay.status === "paid") return "ok";
  const ps = platformSettings();
  const s = await getCheckout(ps.stripe.secretKey, sessionId);
  if (s.metadata?.pay !== pay.id) return "invalid";
  if (isPaid(s, pay.amount, ps.currency)) {
    markPaymentPaid(pay.id, s.payment_intent || s.id);
    audit(pay.slug, "Online subscription payment", pay.slug, `${pay.amount} ${ps.currency} · ${s.payment_intent || s.id}`);
    return "ok";
  }
  if (s.status === "expired") { markPaymentFailed(pay.id, "failed", "Checkout expired"); return "fail"; }
  return "pending";
}
