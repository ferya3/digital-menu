import fs from "node:fs";
import path from "node:path";
import { isAuthed } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/queries";
import { UPLOADS, deleteUpload } from "@/lib/images";
import type { CafeInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

// ویدیو بزرگ‌تر از سقفِ Server Actions است؛ برای همین مستقیم (استریم) روی دیسک نوشته می‌شود
const MAX_BYTES = 100 * 1024 * 1024;
const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};
const DEFAULT_CAFE: CafeInfo = { name: "کافه آرتاویل", logo: "☕", tagline: "", currency: "toman" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

/** آپلود ویدیوی هیرو: بدنهٔ درخواست خودِ فایل است (Content-Type = نوع ویدیو) */
export async function POST(req: Request) {
  if (!(await isAuthed())) return json({ ok: false, error: "ابتدا وارد شوید" }, 401);
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) return json({ ok: false, error: "فقط ویدیوی MP4 یا WebM مجاز است" }, 415);
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) return json({ ok: false, error: "حجم ویدیو بیش از ۱۰۰ مگابایت است" }, 413);
  if (!req.body) return json({ ok: false, error: "فایلی ارسال نشد" }, 400);

  fs.mkdirSync(UPLOADS, { recursive: true });
  const file = `hero-${Date.now()}${ext}`;
  const full = path.join(UPLOADS, file);
  const out = fs.createWriteStream(full);
  let size = 0;
  try {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("حجم ویدیو بیش از ۱۰۰ مگابایت است");
      }
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
    if (size === 0) throw new Error("فایل خالی است");
  } catch (e) {
    out.destroy();
    fs.rmSync(full, { force: true });
    return json({ ok: false, error: e instanceof Error ? e.message : "خطا در آپلود" }, 400);
  }

  const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
  if (cur.heroVideo) deleteUpload(cur.heroVideo);
  const heroVideo = "/uploads/" + file;
  setSetting("cafe", { ...cur, heroVideo });
  return json({ ok: true, heroVideo });
}

/** حذف ویدیو → هیرو به صحنهٔ سه‌بعدی برمی‌گردد */
export async function DELETE() {
  if (!(await isAuthed())) return json({ ok: false, error: "ابتدا وارد شوید" }, 401);
  const cur = getSetting<CafeInfo>("cafe", DEFAULT_CAFE);
  if (cur.heroVideo) deleteUpload(cur.heroVideo);
  setSetting("cafe", { ...cur, heroVideo: "" });
  return json({ ok: true });
}
