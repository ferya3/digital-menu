import { tenantRoute } from "@/lib/tenant";
import { confirmTablePayment } from "@/lib/order-pay";

export const dynamic = "force-dynamic";

/** Return from Stripe Checkout (table bill): verify with Stripe, then back to the menu */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    const sid = new URL(req.url).searchParams.get("session_id") || "";
    let table = "", status = "fail";
    try {
      const r = await confirmTablePayment(sid);
      table = r.table;
      status = r.status === "ok" ? "ok" : r.status === "pending" ? "pending" : "fail";
    } catch { /* invalid or unreachable */ }
    const q = new URLSearchParams({ ...(table ? { table } : {}), pay: status });
    return new Response(null, { status: 303, headers: { Location: `/?${q}` } });
  });
}
