import { classifyHost, requestHost, withTenant } from "@/lib/tenant";
import { saasEnabled } from "@/lib/tenant-context";
import { confirmSubscriptionSession } from "@/lib/subscription-pay";
import { confirmTablePayment } from "@/lib/order-pay";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook (optional — returns from Checkout already confirm payments; this covers customers who close the tab).
 * Point the platform's Stripe account to https://<root-domain>/stripe/webhook and each restaurant's account to
 * https://<their-subdomain>/stripe/webhook, event "checkout.session.completed".
 * The event body is not trusted: the session is re-fetched from Stripe with the matching secret key.
 */
export async function POST(req: Request) {
  let ev: { type?: string; data?: { object?: { id?: string; object?: string; metadata?: Record<string, string> } } };
  try { ev = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
  const obj = ev.data?.object;
  if (!obj?.id || obj.object !== "checkout.session" || !/^checkout\.session\.(completed|async_payment_succeeded)$/.test(ev.type || "")) {
    return Response.json({ ignored: true });
  }
  try {
    const onPlatform = saasEnabled() && classifyHost((await requestHost()).host).kind === "platform";
    if (onPlatform && obj.metadata?.kind === "subscription" && obj.metadata.pay) {
      return Response.json({ result: await confirmSubscriptionSession(obj.metadata.pay, obj.id) });
    }
    if (!onPlatform && obj.metadata?.kind === "order") {
      return Response.json({ result: (await withTenant(() => confirmTablePayment(obj.id!))).status });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
  return Response.json({ ignored: true });
}
