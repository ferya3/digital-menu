import "server-only";
import QRCode from "qrcode";
import { getTenant, tenantState } from "@/lib/platform";
import { tenantUrl } from "@/lib/tenant";

export interface DemoInfo { url: string; qr: string; label: string }

/**
 * منوی نمونهٔ زنده برای صفحه‌های سایت: آدرس (با میزِ ۱ تا سفارش هم امتحان شود) + QRِ SVG برای اسکن از روی مانیتور.
 * اگر منوی نمونه تعیین نشده یا فعال نیست، null (دکمه‌ها نمایش داده نمی‌شوند).
 */
export async function demoInfo(slug: string, label: string): Promise<DemoInfo | null> {
  const t = slug ? getTenant(slug) : null;
  if (!t || !tenantState(t).active) return null;
  const url = await tenantUrl(t, "/?table=1");
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  return { url, qr, label: label || "منوی نمونه را زنده ببینید" };
}
