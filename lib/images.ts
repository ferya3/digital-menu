import "server-only";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { currentTenant } from "@/lib/tenant-context";

// Uploads live next to each venue's database (single backup) and are served via app/uploads
export const uploadsDir = () => path.join(currentTenant().dir, "uploads");

const MAX_BYTES = 10 * 1024 * 1024;

/** Reads and validates the uploaded file from FormData (key "file").
 *  The type is detected from the content (sharp), not the MIME type, since some phones send webp with an empty/odd type. */
export async function readUpload(fd: FormData | null | undefined): Promise<Buffer | null> {
  const f = fd?.get("file");
  if (!f || typeof f === "string") return null;
  if (f.size > MAX_BYTES) throw new Error("The image is larger than 10 MB");
  const buf = Buffer.from(await f.arrayBuffer());
  try {
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) throw new Error("bad");
  } catch {
    throw new Error("The file isn't a valid image (JPG, PNG, WebP, AVIF, HEIC and GIF are accepted)");
  }
  return buf;
}

/** Payment receipt: converted to WebP + a subtle anti-forgery stamp (server side). Returns a hash to detect duplicates. */
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

  // Anti-forgery stamp (ASCII so it renders without a special font)
  const stamp = `CAFE RECEIPT  table ${table}  ${new Date().toISOString().slice(0, 16).replace("T", " ")}  #${hash.slice(0, 8)}`;
  let out: Buffer;
  try {
    const svg = Buffer.from(
      `<svg width="${w}" height="46"><rect width="100%" height="100%" fill="rgba(0,0,0,0.45)"/><text x="12" y="30" font-family="monospace" font-size="18" fill="rgba(255,255,255,0.92)">${stamp}</text></svg>`
    );
    out = await img.composite([{ input: svg, gravity: "south" }]).webp({ quality: 80 }).toBuffer();
  } catch {
    // If stamping fails, save the plain WebP so the payment isn't blocked
    out = await img.webp({ quality: 80 }).toBuffer();
  }
  fs.writeFileSync(path.join(uploadsDir(), file), out);
  return { path: "/uploads/" + file, hash };
}

/** Product/category image: converted to optimized WebP */
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

/** Allowed thumbnail widths (so nobody can generate unlimited files) */
const THUMB_WIDTHS = [160, 320, 480, 720, 1080];
const thumbsDir = () => path.join(uploadsDir(), ".thumbs");
const pending = new Map<string, Promise<string>>();

/** Small WebP version of an uploaded image; returns the cached file path */
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
      // jpg for WhatsApp link previews (WebP isn't shown everywhere)
      const buf = await (format === "jpg" ? img.flatten({ background: "#ffffff" }).jpeg({ quality: 80 }) : img.webp({ quality: 74 })).toBuffer();
      fs.writeFileSync(out, buf);
      return out;
    })().finally(() => pending.delete(out));
    pending.set(out, job);
  }
  return job;
}
