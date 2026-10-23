import "server-only";
import QRCode from "qrcode";
import { getTenant, tenantState } from "@/lib/platform";
import { tenantUrl } from "@/lib/tenant";

export interface DemoInfo { url: string; qr: string; label: string }

/**
 * Live sample menu for the site pages: URL (with table 1 so ordering can be tried too) + an SVG QR to scan from the screen.
 * Returns null when no sample menu is set or it isn't active (the buttons are then hidden).
 */
export async function demoInfo(slug: string, label: string): Promise<DemoInfo | null> {
  const t = slug ? getTenant(slug) : null;
  if (!t || !tenantState(t).active) return null;
  const url = await tenantUrl(t, "/?table=1");
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  return { url, qr, label: label || "See the live sample menu" };
}
