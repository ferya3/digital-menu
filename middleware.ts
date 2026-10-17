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

// نامِ میزبانِ معتبر (دامنه یا IP، با پورتِ اختیاری) — هر چیزِ دیگری در Host رد می‌شود
const VALID_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

/**
 * سرآیندهای امنیتی + CSPِ سخت‌گیرانه با nonceِ تازه برای هر درخواست:
 * فقط اسکریپت‌های خودِ سایت (که Next با همین nonce علامت می‌زند) اجرا می‌شوند؛
 * اسکریپتِ تزریق‌شده (XSS) اجرا نمی‌شود و نمی‌تواند داده یا نشست را بدزدد (کوکی‌ها هم httpOnly‌اند).
 */
function secure(req: NextRequest, res?: NextResponse): NextResponse {
  const https = req.headers.get("x-forwarded-proto") === "https";
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    // عکس از زیردامنهٔ مجموعه‌ها (مثلاً فیش در پنلِ مدیرِ کل)؛ روی نصبِ بدونِ SSL هم http
    `img-src 'self' data: blob: https:${https ? "" : " http:"}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  let out = res;
  if (!out) {
    const h = new Headers(req.headers);
    h.set("x-nonce", nonce);
    h.set("Content-Security-Policy", csp); // Next از این، nonce را روی اسکریپت‌های خودش می‌گذارد
    out = NextResponse.next({ request: { headers: h } });
  }
  out.headers.set("Content-Security-Policy", csp);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("X-Frame-Options", "SAMEORIGIN");
  out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // دوربین فقط برای اسکنِ QR در همین سایت
  out.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  out.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (https) out.headers.set("Strict-Transport-Security", "max-age=31536000");
  return out;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const r = root();
  const rawHost = (req.headers.get("host") || "").toLowerCase();
  // Host نامعتبر (تزریق در سرآیند) — مستقل از تنظیماتِ Nginx رد می‌شود
  if (!VALID_HOST.test(rawHost)) return new NextResponse("Bad Request", { status: 400 });
  const host = rawHost.replace(/:\d+$/, "");
  const onRoot = !!r && (host === r || host === `www.${r}`);

  if (!onRoot) return secure(req);

  // QR/لینک‌های قدیمیِ دامنهٔ اصلی → زیردامنهٔ مجموعهٔ اصلی (LEGACY_TENANT)
  const legacy = (process.env.LEGACY_TENANT || "").trim().toLowerCase();
  if (legacy && (LEGACY.test(url.pathname) || (url.pathname === "/" && url.searchParams.has("table")))) {
    const proto = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    const port = (req.headers.get("host") || "").match(/:\d+$/)?.[0] || "";
    return secure(req, NextResponse.redirect(`${proto}://${legacy}.${r}${port}${url.pathname}${url.search}`, 308));
  }

  return secure(req);
}
