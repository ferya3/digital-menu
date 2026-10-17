import { startSession } from "@/lib/auth";
import { verifyPlatform } from "@/lib/platform";
import { currentTenant, saasEnabled } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// هر لینکِ ورود فقط یک‌بار
const g = globalThis as unknown as { __usedEnter?: Map<string, number> };
const used = (g.__usedEnter ??= new Map());

// آدرسِ نسبی: پشتِ Nginx پروتکل/دامنه همان می‌ماند
const back = (q = "") => new Response(null, { status: 303, headers: { Location: "/staff" + q } });

/** ورودِ خودکار به پنل با لینکِ امضاشدهٔ پلتفرم (بعد از ثبت‌نام، یا «ورود» از پنلِ مدیرِ کل) */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    if (!saasEnabled()) return back();
    const d = verifyPlatform<{ slug: string; p: string }>(new URL(req.url).searchParams.get("t"));
    if (!d || d.p !== "enter" || d.slug !== currentTenant().slug || used.has(d.n)) return back("?enter=expired");
    used.set(d.n, Date.now());
    for (const [k, t] of used) if (Date.now() - t > 3600_000) used.delete(k);
    await startSession();
    return back("?welcome=1");
  });
}
