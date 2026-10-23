import { isAuthed } from "@/lib/auth";
import { listFeedback, listOrders, listRequests } from "@/lib/queries";
import { tenantRoute } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Full dashboard state in one request (parallel, not queued behind Server Actions) */
export async function GET() {
  return tenantRoute(async () => {
    if (!(await isAuthed())) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json(
      { orders: listOrders(), requests: listRequests(), feedback: listFeedback() },
      { headers: { "Cache-Control": "no-store" } }
    );
  });
}
