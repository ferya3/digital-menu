import "server-only";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { currentTenant } from "@/lib/tenant-context";

// آپلودها کنارِ دیتابیسِ هر مجموعه نگه داشته می‌شوند (بک‌آپ یکجا) و با app/uploads سرو می‌شوند
export const uploadsDir = () => path.join(currentTenant().dir, "uploads");

const MAX_BYTES = 10 * 1024 * 1024;

/** فایلِ ارسالی در FormData (کلید file) را می‌خواند و بررسی می‌کند.
 *  نوعِ فایل از روی «محتوا» (sharp) تشخیص داده می‌شود نه از MIME؛ چون بعضی گوشی‌ها webp را با نوعِ خالی/عجیب می‌فرستند. */
export async function readUpload(fd: FormData | null | undefined): Promise<Buffer | null> {
  const f = fd?.get("file");
  if (!f || typeof f === "string") return null;
  if (f.size > MAX_BYTES) throw new Error("حجم تصویر بیش از ۱۰ مگابایت است");
  const buf = Buffer.from(await f.arrayBuffer());
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new Error("bad");
  } catch {
    throw new Error("فایل، یک تصویرِ معتبر نیست (فرمت‌های JPG، PNG، WebP، AVIF، HEIC، GIF پذیرفته می‌شود)");
  }
  return buf;
}

/** رسید پرداخت: تبدیل به WebP + مهرِ ضدجعلِ کم‌رنگ (سمت سرور). هش برای تشخیص تکراری برمی‌گردد. */
export async function saveReceiptWebp(
  buf: Buffer,
  table: string
): Promise<{ path: string; hash: string }> {
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const file = `receipt-t${table}-${Date.now()}.webp`;

  const base = sharp(buf).rotate();
  const meta = await base.metadata();
  const w = Math.min(meta.width || 900, 1200);
  const img = base.resize(w, undefined, { withoutEnlargement: true });

  // مهرِ ضدجعل (ASCII تا بدون نیاز به فونت خاص رندر شود)
  const stamp = `CAFE RECEIPT  table ${table}  ${new Date().toISOString().slice(0, 16).replace("T", " ")}  #${hash.slice(0, 8)}`;
  let out: Buffer;
  try {
    const svg = Buffer.from(
      `<svg width="${w}" height="46"><rect width="100%" height="100%" fill="rgba(0,0,0,0.45)"/><text x="12" y="30" font-family="monospace" font-size="18" fill="rgba(255,255,255,0.92)">${stamp}</text></svg>`
    );
    out = await img.composite([{ input: svg, gravity: "south" }]).webp({ quality: 80 }).toBuffer();
  } catch {
    // اگر حک‌کردن شکست خورد، فقط WebP ذخیره می‌شود تا پرداخت بلاک نشود
    out = await img.webp({ quality: 80 }).toBuffer();
  }
  fs.writeFileSync(path.join(uploadsDir(), file), out);
  return { path: "/uploads/" + file, hash };
}

/** عکس محصول/دسته: تبدیل به WebP بهینه */
export async function saveImageWebp(buf: Buffer, label: string, size = 1000): Promise<string> {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const file = `${label}-${Date.now()}.webp`;
  const out = await sharp(buf)
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  fs.writeFileSync(path.join(uploadsDir(), file), out);
  return "/uploads/" + file;
}

export function deleteUpload(webPath: string) {
  try {
    if (!webPath?.startsWith("/uploads/")) return;
    const f = path.join(uploadsDir(), path.basename(webPath));
    if (f.startsWith(uploadsDir()) && fs.existsSync(f)) fs.unlinkSync(f);
    const base = path.basename(f, path.extname(f));
    if (fs.existsSync(thumbsDir()))
      for (const t of fs.readdirSync(thumbsDir())) if (t.startsWith(base + "-")) fs.unlinkSync(path.join(thumbsDir(), t));
  } catch {
    /* best effort */
  }
}

/** عرض‌های مجاز برای نسخهٔ کوچک (تا کسی نتواند بی‌نهایت فایل بسازد) */
const THUMB_WIDTHS = [160, 320, 480, 720, 1080];
const thumbsDir = () => path.join(uploadsDir(), ".thumbs");
const pending = new Map<string, Promise<string>>();

/** نسخهٔ کوچکِ WebP از یک عکسِ آپلودی؛ مسیرِ فایلِ کش‌شده را برمی‌گرداند */
export async function thumbnail(src: string, width: number, format: "webp" | "jpg" = "webp"): Promise<string | null> {
  const w = THUMB_WIDTHS.find((x) => x >= width) ?? THUMB_WIDTHS[THUMB_WIDTHS.length - 1];
  const out = path.join(thumbsDir(), `${path.basename(src, path.extname(src))}-${w}.${format}`);
  if (fs.existsSync(out)) return out;
  if (!fs.existsSync(src)) return null;
  let job = pending.get(out);
  if (!job) {
    job = (async () => {
      fs.mkdirSync(thumbsDir(), { recursive: true });
      const img = sharp(src).resize(w, w, { fit: "inside", withoutEnlargement: true });
      // jpg برای پیش‌نمایشِ لینک در واتساپ (WebP را همه‌جا نشان نمی‌دهد)
      const buf = await (format === "jpg" ? img.flatten({ background: "#ffffff" }).jpeg({ quality: 80 }) : img.webp({ quality: 74 })).toBuffer();
      fs.writeFileSync(out, buf);
      return out;
    })().finally(() => pending.delete(out));
    pending.set(out, job);
  }
  return job;
}
