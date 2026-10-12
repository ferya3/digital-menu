import "server-only";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// آپلودها کنارِ دیتابیس در data/ نگه داشته می‌شوند (بک‌آپ یکجا) و با app/uploads سرو می‌شوند
export const UPLOADS = path.join(process.cwd(), "data", "uploads");

const MAX_BYTES = 10 * 1024 * 1024;

/** فایلِ ارسالی در FormData (کلید file) را می‌خواند و بررسی می‌کند */
export async function readUpload(fd: FormData | null | undefined): Promise<Buffer | null> {
  const f = fd?.get("file");
  if (!f || typeof f === "string") return null;
  if (f.size > MAX_BYTES) throw new Error("حجم تصویر بیش از ۱۰ مگابایت است");
  if (f.type && !f.type.startsWith("image/")) throw new Error("فقط فایل تصویری مجاز است");
  return Buffer.from(await f.arrayBuffer());
}

/** رسید پرداخت: تبدیل به WebP + مهرِ ضدجعلِ کم‌رنگ (سمت سرور). هش برای تشخیص تکراری برمی‌گردد. */
export async function saveReceiptWebp(
  buf: Buffer,
  table: string
): Promise<{ path: string; hash: string }> {
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  fs.mkdirSync(UPLOADS, { recursive: true });
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
  fs.writeFileSync(path.join(UPLOADS, file), out);
  return { path: "/uploads/" + file, hash };
}

/** عکس محصول/دسته: تبدیل به WebP بهینه */
export async function saveImageWebp(buf: Buffer, label: string, size = 1000): Promise<string> {
  fs.mkdirSync(UPLOADS, { recursive: true });
  const file = `${label}-${Date.now()}.webp`;
  const out = await sharp(buf)
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  fs.writeFileSync(path.join(UPLOADS, file), out);
  return "/uploads/" + file;
}

export function deleteUpload(webPath: string) {
  try {
    if (!webPath?.startsWith("/uploads/")) return;
    const f = path.join(UPLOADS, path.basename(webPath));
    if (f.startsWith(UPLOADS) && fs.existsSync(f)) fs.unlinkSync(f);
  } catch {
    /* best effort */
  }
}
