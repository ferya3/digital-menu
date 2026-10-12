import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { UPLOADS, thumbnail } from "@/lib/images";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/** فایل‌های آپلودی (رسید، عکس محصول، لوگو، ویدیوی هیرو) را از data/uploads سرو می‌کند */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(file); // جلوگیری از خروج از پوشه (../)
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  let full = path.join(UPLOADS, name);
  let ctype = type;

  // نسخهٔ کوچکِ عکس برای منو: ?w=480 (یک‌بار ساخته و روی دیسک نگه داشته می‌شود)
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (w && type.startsWith("image/")) {
    const t = await thumbnail(full, w).catch(() => null);
    if (t) { full = t; ctype = "image/webp"; }
  }

  let size: number;
  try {
    size = (await fs.promises.stat(full)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers: Record<string, string> = {
    "Content-Type": ctype,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };

  // ویدیو در مرورگرها (به‌خصوص سافاری) با درخواستِ Range تکه‌تکه خوانده می‌شود
  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = Math.min(m[1] && m[2] ? Number(m[2]) : size - 1, size - 1);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
}
