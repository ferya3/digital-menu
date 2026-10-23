import { currentTenant } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant";
import { getPayment, markPaymentFailed } from "@/lib/platform";
import { confirmSubscriptionSession } from "@/lib/subscription-pay";

export const dynamic = "force-dynamic";

const back = (q: string) => new Response(null, { status: 303, headers: { Location: "/staff?billing=" + q } });

/** Return from Stripe Checkout: verify server-to-server and renew the subscription */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    const sp = new URL(req.url).searchParams;
    const pay = getPayment(sp.get("pay") || "");
    if (!pay || pay.slug !== currentTenant().slug || pay.method !== "stripe") return back("invalid");
    if (pay.status === "paid") return back("ok");
    if (sp.get("cancel")) {
      markPaymentFailed(pay.id, "failed", "Payment cancelled");
      return back("cancel");
    }
    try {
      const r = await confirmSubscriptionSession(pay.id, sp.get("session_id") || "");
      return back(r === "pending" ? "pending" : r);
    } catch {
      return back("fail");
    }
  });
}
