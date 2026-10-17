import { currentTenant } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant";
import { getPayment, markPaymentFailed, markPaymentPaid, platformSettings } from "@/lib/platform";
import { zarinpalVerify } from "@/lib/zarinpal";

export const dynamic = "force-dynamic";

const back = (q: string) => new Response(null, { status: 303, headers: { Location: "/staff?billing=" + q } });

/** بازگشت از درگاهِ زرین‌پال: تأییدِ سرور‌به‌سرور و تمدیدِ اشتراک */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    const sp = new URL(req.url).searchParams;
    const pay = getPayment(sp.get("pay") || "");
    const authority = sp.get("Authority") || "";
    if (!pay || pay.slug !== currentTenant().slug || pay.method !== "zarinpal" || pay.authority !== authority) return back("invalid");
    if (pay.status === "paid") return back("ok");
    if (sp.get("Status") !== "OK") {
      markPaymentFailed(pay.id, "failed", "پرداخت لغو شد");
      return back("cancel");
    }
    const ps = platformSettings();
    const v = await zarinpalVerify({ merchant: ps.zarinpal.merchant, sandbox: ps.zarinpal.sandbox, amountRial: pay.amount * 10, authority });
    if (!v.ok) {
      markPaymentFailed(pay.id, "failed", v.message);
      return back("fail");
    }
    markPaymentPaid(pay.id, v.refId);
    return back("ok");
  });
}
