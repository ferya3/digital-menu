import { NextResponse, type NextRequest } from "next/server";

/**
 * مسیریابیِ دامنه‌ها (حالتِ چندمستاجری، با ROOT_DOMAIN):
 *   example.com / www.example.com   → سایتِ پلتفرم (صفحهٔ اصلی، /signup، /login، /admin — خودِ صفحه‌ها دامنه را بررسی می‌کنند)
 *   <slug>.example.com یا دامنهٔ اختصاصی → منو و پنلِ همان مجموعه (تشخیص در lib/tenant)
 * بدونِ ROOT_DOMAIN همه‌چیز مثل قبل (تک‌مجموعه‌ای) است.
 */
export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
  runtime: "nodejs",
};

// مسیرهای نسخهٔ تک‌مجموعه‌ایِ قبلی که روی دامنهٔ اصلی بودند (QRهای چاپ‌شده)
const LEGACY = /^\/(staff|p|print|live|uploads|qr|billing)(\/|$)/;

function root() {
  return (process.env.ROOT_DOMAIN || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/.]+$/, "");
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const r = root();
  const host = (req.headers.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const onRoot = !!r && (host === r || host === `www.${r}`);

  if (!onRoot) return NextResponse.next();

  // QR/لینک‌های قدیمیِ دامنهٔ اصلی → زیردامنهٔ مجموعهٔ اصلی (LEGACY_TENANT)
  const legacy = (process.env.LEGACY_TENANT || "").trim().toLowerCase();
  if (legacy && (LEGACY.test(url.pathname) || (url.pathname === "/" && url.searchParams.has("table")))) {
    const proto = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    const port = (req.headers.get("host") || "").match(/:\d+$/)?.[0] || "";
    return NextResponse.redirect(`${proto}://${legacy}.${r}${port}${url.pathname}${url.search}`, 308);
  }

  return NextResponse.next();
}
