import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const table = req.nextUrl.searchParams.get("table") || "1";
  const origin = req.nextUrl.origin;
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
