import { sseResponse } from "@/lib/live";
import { tenantRoute } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** کانال زندهٔ مشتری: فقط تغییراتِ میزِ خودش (وضعیت سفارش، تأیید/رد فیش) */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    const table = new URL(req.url).searchParams.get("table") || "";
    if (!table) return new Response("table required", { status: 400 });
    return sseResponse(req, (ev) => ev.table === table && (ev.type === "order" || ev.type === "receipt"));
  });
}
