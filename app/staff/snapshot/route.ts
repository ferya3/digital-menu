import { isAuthed } from "@/lib/auth";
import { listFeedback, listOrders, listRequests } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** وضعیت کامل داشبورد در یک درخواست (موازی، بدون صفِ Server Actions) */
export async function GET() {
  if (!(await isAuthed())) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(
    { orders: listOrders(), requests: listRequests(), feedback: listFeedback() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
