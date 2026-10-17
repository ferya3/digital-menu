import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table") || "1";
  // پشتِ Nginx: آدرسِ واقعی (دامنه + https) از هدرهای پراکسی
  // فقط Host (که Nginx می‌گذارد)؛ X-Forwarded-Host را کاربر می‌تواند جعل کند
  const host = req.headers.get("host") || req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  const origin = `${proto}://${host}`;
  const url = `${origin}/?table=${encodeURIComponent(table)}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 320, margin: 1 });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "خطا در تولید QR" }, { status: 500 });
  }
}
