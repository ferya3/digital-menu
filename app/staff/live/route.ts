import { isAuthed } from "@/lib/auth";
import { sseResponse } from "@/lib/live";

export const dynamic = "force-dynamic";

/** کانال زندهٔ پنل مدیر: هر سفارش/فیش/درخواست/نظرِ جدید فوراً اعلام می‌شود */
export async function GET(req: Request) {
  if (!(await isAuthed())) return new Response("Unauthorized", { status: 401 });
  return sseResponse(req, () => true);
}
