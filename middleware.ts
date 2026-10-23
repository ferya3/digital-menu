import { NextResponse, type NextRequest } from "next/server";

/**
 * Domain routing (multi-tenant mode, with ROOT_DOMAIN):
 *   example.com / www.example.com        → platform site (home, /signup, /login, /admin — pages check the host themselves)
 *   <slug>.example.com or a custom domain → that venue's menu and panel (resolved in lib/tenant)
 * Without ROOT_DOMAIN everything runs in single-venue mode.
 */
export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
  runtime: "nodejs",
};

// Single-venue paths that used to live on the root domain (printed QR codes)
const LEGACY = /^\/(staff|p|print|live|uploads|qr|billing)(\/|$)/;

function root() {
  return (process.env.ROOT_DOMAIN || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/.]+$/, "");
}

// Valid host name (domain or IP, optional port) — anything else in Host is rejected
const VALID_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;

/**
 * Security headers + a strict CSP with a fresh nonce per request:
 * only the site's own scripts (tagged by Next with this nonce) run;
 * injected scripts (XSS) don't run and can't steal data or sessions (cookies are httpOnly too).
 * Stripe Checkout is reached by a top-level navigation (window.location / redirect), which CSP doesn't restrict;
 * Stripe and Twilio API calls are server-side only, so connect-src stays 'self'.
 */
function secure(req: NextRequest, res?: NextResponse): NextResponse {
  const https = req.headers.get("x-forwarded-proto") === "https";
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    // Images from venue subdomains (e.g. receipts in the super admin panel); http too on installs without SSL
    `img-src 'self' data: blob: https:${https ? "" : " http:"}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Stripe allowed as a safety net for no-JS form posts that redirect to Checkout
    "form-action 'self' https://checkout.stripe.com",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  let out = res;
  if (!out) {
    const h = new Headers(req.headers);
    h.set("x-nonce", nonce);
    h.set("Content-Security-Policy", csp); // Next reads the nonce from this and applies it to its own scripts
    out = NextResponse.next({ request: { headers: h } });
  }
  out.headers.set("Content-Security-Policy", csp);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("X-Frame-Options", "SAMEORIGIN");
  out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Camera only for QR scanning on this site
  out.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  out.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (https) out.headers.set("Strict-Transport-Security", "max-age=31536000");
  return out;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const r = root();
  const rawHost = (req.headers.get("host") || "").toLowerCase();
  // Invalid Host (header injection) — rejected regardless of the Nginx config
  if (!VALID_HOST.test(rawHost)) return new NextResponse("Bad Request", { status: 400 });
  const host = rawHost.replace(/:\d+$/, "");
  const onRoot = !!r && (host === r || host === `www.${r}`);

  if (!onRoot) return secure(req);

  // Partner link: /r/<code> or ?ref=<code> → cookie (60 days) and redirect to the clean URL (no ref, avoids duplicate pages)
  const refPath = url.pathname.match(/^\/r\/([A-Za-z0-9-]{3,20})\/?$/);
  const refQuery = url.searchParams.get("ref");
  if (refPath || refQuery) {
    const code = (refPath?.[1] || refQuery || "").toLowerCase();
    const proto = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    const port = rawHost.match(/:\d+$/)?.[0] || "";
    const clean = new URL(url.toString());
    clean.searchParams.delete("ref");
    const target = refPath ? "/" : `${clean.pathname}${clean.search}`;
    const res = NextResponse.redirect(`${proto}://${r}${port}${target}`, 302);
    if (/^[a-z0-9][a-z0-9-]{2,19}$/.test(code)) {
      res.cookies.set("pref", code, { maxAge: 60 * 24 * 3600, path: "/", sameSite: "lax", httpOnly: true, secure: proto === "https" });
    }
    return secure(req, res);
  }

  // www → root domain (301) so search engines don't see duplicate copies of the site
  if (host === `www.${r}`) {
    const proto = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    const port = rawHost.match(/:\d+$/)?.[0] || "";
    return secure(req, NextResponse.redirect(`${proto}://${r}${port}${url.pathname}${url.search}`, 301));
  }

  // Old QR codes/links on the root domain → the main venue's subdomain (LEGACY_TENANT)
  const legacy = (process.env.LEGACY_TENANT || "").trim().toLowerCase();
  if (legacy && (LEGACY.test(url.pathname) || (url.pathname === "/" && url.searchParams.has("table")))) {
    const proto = req.headers.get("x-forwarded-proto") === "https" ? "https" : "http";
    const port = (req.headers.get("host") || "").match(/:\d+$/)?.[0] || "";
    return secure(req, NextResponse.redirect(`${proto}://${legacy}.${r}${port}${url.pathname}${url.search}`, 308));
  }

  return secure(req);
}
