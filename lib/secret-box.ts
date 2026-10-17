import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

/**
 * رمزگذاریِ اطلاعاتِ حساس در دیتابیس (AES-256-GCM): رمز/کلیدِ سامانهٔ پیامک، درگاه‌های پرداخت،
 * مرچنتِ زرین‌پال و کلیدهای امضا. اگر فقط فایلِ دیتابیس (یا پوشهٔ data) لو برود، این‌ها خوانا نیستند.
 * کلید: DATA_KEY در محیط، یا فایلِ .data-key کنارِ برنامه (بیرون از data/، فقط root) که خودکار ساخته می‌شود.
 */
const PREFIX = "enc:v1:";
let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const env = (process.env.DATA_KEY || "").trim();
  if (/^[0-9a-f]{64}$/i.test(env)) return (cached = Buffer.from(env, "hex"));
  const file = path.join(process.cwd(), ".data-key");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex") + "\n", { mode: 0o600, flag: "wx" });
  }
  const hex = fs.readFileSync(file, "utf8").trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error(".data-key نامعتبر است");
  return (cached = Buffer.from(hex, "hex"));
}

export const isSealed = (v: string) => typeof v === "string" && v.startsWith(PREFIX);

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function unseal(v: string): string {
  if (!isSealed(v)) return v; // مقدارِ قدیمیِ رمزنشده
  const buf = Buffer.from(v.slice(PREFIX.length), "base64url");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/** کلیدهای تنظیماتی که رمزشده ذخیره می‌شوند */
export const SECRET_SETTINGS = new Set(["sms", "gateways", "session_secret", "platform", "secret"]);

/** یک‌بار: مقدارهای حساسِ قدیمیِ رمزنشده را رمز می‌کند */
export function sealExisting(db: DatabaseSync) {
  // داده‌های پاک‌شده با صفر بازنویسی شوند (رمزِ قدیمی در صفحه‌های آزادِ فایل نماند)
  db.exec("PRAGMA secure_delete = ON");
  const rows = db.prepare("SELECT key, value FROM settings").all() as unknown as { key: string; value: string }[];
  let changed = 0;
  for (const r of rows) {
    if (SECRET_SETTINGS.has(r.key) && r.value && !isSealed(r.value)) {
      db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(seal(r.value), r.key);
      changed++;
    }
  }
  // بعد از رمزکردنِ مقدارهای قدیمی، فایل بازنویسی می‌شود تا نسخهٔ رمزنشده هیچ‌جا باقی نماند
  if (changed) db.exec("PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);");
}
