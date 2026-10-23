import { sseResponse } from "@/lib/live";
import { tenantRoute } from "@/lib/tenant";
import { currentTenant } from "@/lib/tenant-context";
import { clientIp, ownsTable } from "@/lib/security";
import { hit } from "@/lib/limits";

export const dynamic = "force-dynamic";

/**
 * Customer live channel: only changes for their own table (order status, receipt approved/rejected) —
 * and only for the browser that ordered at this table (signed orders cookie).
 * Any non-200 response stops the browser from reconnecting.
 */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    const table = new URL(req.url).searchParams.get("table") || "";
    if (!table) return new Response("table required", { status: 400 });
    try {
      hit(`sse:${currentTenant().slug}:${await clientIp()}`, 30, 60_000);
    } catch {
      return new Response("Too many connections", { status: 429 });
    }
    if (!(await ownsTable(table))) return new Response(null, { status: 204 });
    return sseResponse(req, (ev) => ev.table === table && (ev.type === "order" || ev.type === "receipt"));
  });
}
