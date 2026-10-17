import { startSession } from "@/lib/auth";
import { verifyPlatform } from "@/lib/platform";
import { currentTenant, saasEnabled } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant";
import { consumeOnce } from "@/lib/limits";

export const dynamic = "force-dynamic";

// آدرسِ نسبی: پشتِ Nginx پروتکل/دامنه همان می‌ماند
const back = (q = "") => new Response(null, { status: 303, headers: { Location: "/staff" + q } });

/** ورودِ خودکار به پنل با لینکِ امضاشدهٔ پلتفرم (بعد از ثبت‌نام، یا «ورود» از پنلِ مدیرِ کل) */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    if (!saasEnabled()) return back();
    const d = verifyPlatform<{ slug: string; p: string }>(new URL(req.url).searchParams.get("t"));
    // هر لینک فقط یک‌بار — ثبت در data/limits.db (با ری‌استارتِ سرور هم دوباره قابلِ استفاده نمی‌شود)
    if (!d || d.p !== "enter" || d.slug !== currentTenant().slug || !consumeOnce("enter:" + d.n, 3600_000)) return back("?enter=expired");
    await startSession();
    return back("?welcome=1");
  });
}
