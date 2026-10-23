import { isAuthed } from "@/lib/auth";
import { sseResponse } from "@/lib/live";
import { tenantRoute } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** Dashboard live channel: every new order/receipt/request/review is announced immediately */
export async function GET(req: Request) {
  return tenantRoute(async () => {
    if (!(await isAuthed())) return new Response("Unauthorized", { status: 401 });
    return sseResponse(req, () => true);
  });
}
